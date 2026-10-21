<?php
require_once __DIR__ . '/config.php';

// Returns a shared PDO connection (SQLite via PDO), creating schema + seed on first run.
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!is_dir(DB_DIR)) {
        @mkdir(DB_DIR, 0775, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');

    // Treat the database as new unless the core schema is present. Checking for
    // the table (rather than just file existence) keeps an empty/partial file
    // from silently disabling schema creation and seeding.
    $hasSchema = (bool) $pdo->query(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1"
    )->fetchColumn();

    if (!$hasSchema) {
        db_migrate($pdo);
        db_seed($pdo);
    }
    db_upgrade($pdo);
    return $pdo;
}

// Idempotent column additions so existing databases keep working.
function db_upgrade(PDO $pdo): void {
    // Ensure the teams table exists even for databases created before it.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS teams (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at    TEXT NOT NULL DEFAULT (datetime(\'now\'))
        )'
    );
    // Seed the default department list exactly once per database. Using a flag
    // (rather than "table is empty") means teams an admin later deletes are not
    // resurrected on the next request.
    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT \'\')');
    $seeded = $pdo->query("SELECT 1 FROM meta WHERE key = 'teams_seeded'")->fetchColumn();
    if (!$seeded) {
        seed_default_teams($pdo);
        $pdo->prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('teams_seeded', '1')")->execute();
    }
    $additions = [
        'officials' => [
            'kingschat_handle' => "ALTER TABLE officials ADD COLUMN kingschat_handle TEXT NOT NULL DEFAULT ''",
            'accommodation'    => 'ALTER TABLE officials ADD COLUMN accommodation INTEGER NOT NULL DEFAULT 0',
            'hq_staff_member'  => 'ALTER TABLE officials ADD COLUMN hq_staff_member INTEGER NOT NULL DEFAULT 0',
            'email'            => "ALTER TABLE officials ADD COLUMN email TEXT NOT NULL DEFAULT ''",
            'team_id'          => 'ALTER TABLE officials ADD COLUMN team_id INTEGER',
        ],
        'roster_entries' => [
            'approved' => 'ALTER TABLE roster_entries ADD COLUMN approved INTEGER NOT NULL DEFAULT 0',
        ],
        'users' => [
            'team_id' => 'ALTER TABLE users ADD COLUMN team_id INTEGER',
        ],
    ];
    foreach ($additions as $table => $columns) {
        $cols = $pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll();
        $have = array_column($cols, 'name');
        foreach ($columns as $name => $sql) {
            if (!in_array($name, $have, true)) {
                $pdo->exec($sql);
            }
        }
    }
}

function db_migrate(PDO $pdo): void {
    $pdo->exec(<<<SQL
    CREATE TABLE teams (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL,
        first_name    TEXT NOT NULL DEFAULT '',
        last_name     TEXT NOT NULL DEFAULT '',
        kingschat_phone TEXT NOT NULL DEFAULT '',
        team_id       INTEGER,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        venue         TEXT NOT NULL DEFAULT '',
        event_date    TEXT NOT NULL DEFAULT '',
        start_time    TEXT NOT NULL DEFAULT '',
        end_time      TEXT NOT NULL DEFAULT '',
        token         TEXT NOT NULL UNIQUE,
        expected_count INTEGER NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'open',
        created_by    INTEGER,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE officials (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id      INTEGER NOT NULL,
        title         TEXT NOT NULL DEFAULT '',
        first_name    TEXT NOT NULL,
        last_name     TEXT NOT NULL,
        kingschat_phone TEXT NOT NULL,
        kingschat_handle TEXT NOT NULL DEFAULT '',
        email         TEXT NOT NULL DEFAULT '',
        team_id       INTEGER,
        accommodation INTEGER NOT NULL DEFAULT 0,
        hq_staff_member INTEGER NOT NULL DEFAULT 0,
        role          TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE submissions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id      INTEGER NOT NULL,
        team_leader_id INTEGER NOT NULL,
        status        TEXT NOT NULL DEFAULT 'draft',
        note          TEXT NOT NULL DEFAULT '',
        review_note   TEXT NOT NULL DEFAULT '',
        reviewed_by   INTEGER,
        submitted_at  TEXT,
        reviewed_at   TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (event_id, team_leader_id),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE roster_entries (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        official_id   INTEGER NOT NULL,
        approved      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (submission_id, official_id),
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE CASCADE
    );
    SQL);
}

// Default department/team list (seeded once when the teams table is empty).
function default_team_names(): array {
    return [
        '3A EVENTS OPERATIVES',
        'ACCESS CONTROL BACK END',
        'ACCESS CONTROL FRONT END',
        'ACCREDITATION',
        'ASSET MGT',
        'CAR PARK',
        'CHILD CARE',
        'COMMAND CENTRE',
        'DECORATION TEAM',
        'DIGITAL LIB',
        'DSS',
        'EMERGENCY SERVICES',
        'EQUIPMENT CARE',
        'ESPEES CORP',
        'FACILITY MGT/SEAT ARRANGE',
        'FINANCE',
        'FIRE SAFETY',
        'FLOOR MGT',
        'FOOD COURT MGT',
        'HOSTS AND HOSTESSES',
        'INFORMATION SERVICE',
        'INTERVIEW CREW',
        'LED',
        'LIGHTING',
        'LOVEWORLD NEWS',
        'MEDICALS',
        'OCEO CONTENT',
        'PHOTOGRAPHY',
        'POWER DISTRIBUTION',
        'POWER GENERATION',
        'PROGRAM MGT/MONITORING',
        'REGISTRATION/RESOLUTION',
        'SEAT RESERVATION',
        'SECRETARIAT',
        'SECURITY',
        'CAMP GROUND SECURITY',
        'SIM TEAM (B. TUCKER)',
        'SOUND 1',
        'SPECIAL DUTIES',
        'STAGE SET',
        'STREAMING',
        'TABLE SET UP',
        'TEA STATION / EXHIBITION',
        'TRANSPORTATION',
        'TUCKSHOP /WATER STATION',
        'USHERING',
        'VENUE SAFETY',
        'VIDEO PRODUCTION',
        'VVIP PLATINUM LOUNGE',
        'WORKSHOP C/O ESTEEMED PST LANRE',
        'HOTEL ACCREDITATION',
        "DOP'S PA & DRIVER",
        'SPECIAL EFFECTS',
        'LOVEWORLD CITY',
        'INTERNATIONAL DELEGATES WELFARE',
        'IPPC PRESS',
        'OMNIA TRANSPORTATION',
        'SIGNAGES AND MINI RIDE',
        '3A EVENTS OPERATIVES (SIS MARY)',
        'CAMPUS MINISTRY',
        'PROGRAM WELFARE',
        'EVENT MGT',
    ];
}

function seed_default_teams(PDO $pdo): void {
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO teams (name) VALUES (?)');
    foreach (default_team_names() as $name) {
        $stmt->execute([$name]);
    }
}

function db_seed(PDO $pdo): void {
    seed_default_teams($pdo);
    $hash = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, first_name, last_name, kingschat_phone)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insert->execute(['superadmin', $hash, ROLE_SUPER, 'System', 'Overseer', '2348000000000']);
    $insert->execute(['manager', $hash, ROLE_MANAGER, 'Grace', 'Manager', '2348000000001']);
    $insert->execute(['leader', $hash, ROLE_LEADER, 'David', 'Leader', '2348000000002']);
}
