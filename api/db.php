<?php
require_once __DIR__ . '/config.php';

// Returns a shared PDO connection, creating the schema + seed data on first run.
// Supports SQLite (default) and MySQL/MariaDB (cPanel hosting).
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = db_driver() === 'mysql' ? db_connect_mysql() : db_connect_sqlite();

    // Treat the database as new unless the core schema is present. Checking for
    // the table (rather than just a file existing) keeps an empty or partial
    // database from silently disabling schema creation and seeding.
    if (!db_has_schema($pdo)) {
        db_migrate($pdo);
    }
    db_upgrade($pdo);
    db_seed_users_if_empty($pdo);
    return $pdo;
}

function db_driver(): string {
    return strtolower((string) DB_DRIVER) === 'mysql' ? 'mysql' : 'sqlite';
}

function db_is_mysql(): bool {
    return db_driver() === 'mysql';
}

function db_connect_sqlite(): PDO {
    if (!is_dir(DB_DIR)) {
        @mkdir(DB_DIR, 0775, true);
    }
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    return $pdo;
}

function db_connect_mysql(): PDO {
    if (DB_NAME === '' || DB_USER === '') {
        throw new RuntimeException(
            'MySQL is selected but DB_NAME/DB_USER are not set. Add them to api/config.local.php.'
        );
    }
    if (DB_SOCKET !== '') {
        $dsn = 'mysql:unix_socket=' . DB_SOCKET . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    } else {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    }
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    // Store and compare timestamps in UTC so MySQL matches the SQLite behaviour.
    $pdo->exec("SET SESSION time_zone = '+00:00'");
    return $pdo;
}

// SQL fragment that yields the current UTC timestamp.
function sql_now(): string {
    return db_is_mysql() ? 'UTC_TIMESTAMP()' : "datetime('now')";
}

// SQL expression that joins two text columns with a space (full names).
function sql_concat(string $a, string $b): string {
    return db_is_mysql()
        ? "CONCAT($a, ' ', $b)"
        : "($a || ' ' || $b)";
}

// TRUE when the core table already exists.
function db_has_schema(PDO $pdo): bool {
    if (db_is_mysql()) {
        // SHOW TABLES is available to every MySQL user, unlike some
        // information_schema views on shared hosting.
        return (bool) $pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
    }
    return (bool) $pdo->query(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1"
    )->fetchColumn();
}

// Column names of a table (empty when the table does not exist).
function db_columns(PDO $pdo, string $table): array {
    if (db_is_mysql()) {
        try {
            $rows = $pdo->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll();
        } catch (PDOException $e) {
            return [];
        }
        return array_column($rows ?: [], 'Field');
    }
    $cols = $pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll();
    return array_column($cols ?: [], 'name');
}

// Inserts a row, ignoring duplicate-key errors (used for seeding).
function db_insert_ignore(PDO $pdo, string $table, array $columns, array $values): void {
    $place = implode(',', array_fill(0, count($columns), '?'));
    $sql = 'INSERT ' . (db_is_mysql() ? 'IGNORE ' : 'OR IGNORE ')
         . 'INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . $place . ')';
    $pdo->prepare($sql)->execute($values);
}

// Creates a table if it does not exist, using the right syntax per driver.
function db_create_table(PDO $pdo, string $table, string $columns, string $suffix = ''): void {
    $sql = 'CREATE TABLE IF NOT EXISTS ' . $table . ' (' . $columns . ')' . $suffix;
    $pdo->exec($sql);
}

// Idempotent column additions so existing databases keep working.
function db_upgrade(PDO $pdo): void {
    if (db_is_mysql()) {
        db_upgrade_mysql($pdo);
        return;
    }
    db_upgrade_sqlite($pdo);
}

function db_upgrade_sqlite(PDO $pdo): void {
    db_create_table($pdo, 'teams', "
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))"
    );
    db_create_table($pdo, 'meta', "`key` TEXT PRIMARY KEY, `value` TEXT NOT NULL DEFAULT ''");
    db_seed_default_teams_once($pdo);

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
        $have = db_columns($pdo, $table);
        foreach ($columns as $name => $sql) {
            if (!in_array($name, $have, true)) {
                $pdo->exec($sql);
            }
        }
    }
}

function db_upgrade_mysql(PDO $pdo): void {
    db_create_table($pdo, 'teams', "
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name       VARCHAR(191) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_teams_name (name)",
        db_mysql_suffix()
    );
    db_create_table($pdo, 'meta', "
        `key`   VARCHAR(191) NOT NULL,
        `value` TEXT NOT NULL,
        PRIMARY KEY (`key`)",
        db_mysql_suffix()
    );
    db_seed_default_teams_once($pdo);

    $additions = [
        'officials' => [
            'kingschat_handle' => "ALTER TABLE officials ADD COLUMN kingschat_handle VARCHAR(191) NOT NULL DEFAULT ''",
            'accommodation'    => 'ALTER TABLE officials ADD COLUMN accommodation TINYINT(1) NOT NULL DEFAULT 0',
            'hq_staff_member'  => 'ALTER TABLE officials ADD COLUMN hq_staff_member TINYINT(1) NOT NULL DEFAULT 0',
            'email'            => "ALTER TABLE officials ADD COLUMN email VARCHAR(191) NOT NULL DEFAULT ''",
            'team_id'          => 'ALTER TABLE officials ADD COLUMN team_id INT UNSIGNED NULL',
        ],
        'roster_entries' => [
            'approved' => 'ALTER TABLE roster_entries ADD COLUMN approved TINYINT(1) NOT NULL DEFAULT 0',
        ],
        'users' => [
            'team_id' => 'ALTER TABLE users ADD COLUMN team_id INT UNSIGNED NULL',
        ],
    ];
    foreach ($additions as $table => $columns) {
        $have = db_columns($pdo, $table);
        foreach ($columns as $name => $sql) {
            if (!in_array($name, $have, true)) {
                $pdo->exec($sql);
            }
        }
    }
}

// Table options for MySQL/MariaDB.
function db_mysql_suffix(): string {
    return ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
}

function db_migrate(PDO $pdo): void {
    if (db_is_mysql()) {
        db_migrate_mysql($pdo);
        return;
    }
    db_migrate_sqlite($pdo);
}

function db_migrate_sqlite(PDO $pdo): void {
    $pdo->exec(<<<SQL
    CREATE TABLE IF NOT EXISTS teams (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
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

    CREATE TABLE IF NOT EXISTS events (
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

    CREATE TABLE IF NOT EXISTS officials (
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

    CREATE TABLE IF NOT EXISTS submissions (
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

    CREATE TABLE IF NOT EXISTS roster_entries (
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

function db_migrate_mysql(PDO $pdo): void {
    $suffix = db_mysql_suffix();
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS teams (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name       VARCHAR(191) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_teams_name (name)
    ) $suffix");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username      VARCHAR(191) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(32) NOT NULL,
        first_name    VARCHAR(191) NOT NULL DEFAULT '',
        last_name     VARCHAR(191) NOT NULL DEFAULT '',
        kingschat_phone VARCHAR(32) NOT NULL DEFAULT '',
        team_id       INT UNSIGNED NULL,
        must_change_password TINYINT(1) NOT NULL DEFAULT 1,
        active        TINYINT(1) NOT NULL DEFAULT 1,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_username (username),
        KEY idx_users_team (team_id),
        CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    ) $suffix");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS events (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name          VARCHAR(191) NOT NULL,
        description   TEXT NOT NULL,
        venue         VARCHAR(191) NOT NULL DEFAULT '',
        event_date    VARCHAR(20) NOT NULL DEFAULT '',
        start_time    VARCHAR(20) NOT NULL DEFAULT '',
        end_time      VARCHAR(20) NOT NULL DEFAULT '',
        token         VARCHAR(64) NOT NULL,
        expected_count INT NOT NULL DEFAULT 0,
        status        VARCHAR(20) NOT NULL DEFAULT 'open',
        created_by    INT UNSIGNED NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_events_token (token),
        KEY idx_events_created_by (created_by),
        CONSTRAINT fk_events_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) $suffix");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS officials (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        owner_id      INT UNSIGNED NOT NULL,
        title         VARCHAR(100) NOT NULL DEFAULT '',
        first_name    VARCHAR(191) NOT NULL,
        last_name     VARCHAR(191) NOT NULL,
        kingschat_phone VARCHAR(32) NOT NULL,
        kingschat_handle VARCHAR(191) NOT NULL DEFAULT '',
        email         VARCHAR(191) NOT NULL DEFAULT '',
        team_id       INT UNSIGNED NULL,
        accommodation TINYINT(1) NOT NULL DEFAULT 0,
        hq_staff_member TINYINT(1) NOT NULL DEFAULT 0,
        role          VARCHAR(191) NOT NULL DEFAULT '',
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_officials_owner (owner_id),
        KEY idx_officials_team (team_id),
        CONSTRAINT fk_officials_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_officials_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    ) $suffix");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS submissions (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id      INT UNSIGNED NOT NULL,
        team_leader_id INT UNSIGNED NOT NULL,
        status        VARCHAR(20) NOT NULL DEFAULT 'draft',
        note          VARCHAR(1000) NOT NULL DEFAULT '',
        review_note   VARCHAR(1000) NOT NULL DEFAULT '',
        reviewed_by   INT UNSIGNED NULL,
        submitted_at  DATETIME NULL,
        reviewed_at   DATETIME NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_submissions_event_leader (event_id, team_leader_id),
        KEY idx_submissions_leader (team_leader_id),
        CONSTRAINT fk_submissions_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        CONSTRAINT fk_submissions_leader FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE CASCADE
    ) $suffix");

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS roster_entries (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        submission_id INT UNSIGNED NOT NULL,
        official_id   INT UNSIGNED NOT NULL,
        approved      TINYINT(1) NOT NULL DEFAULT 0,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_roster_submission_official (submission_id, official_id),
        KEY idx_roster_official (official_id),
        CONSTRAINT fk_roster_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        CONSTRAINT fk_roster_official FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE CASCADE
    ) $suffix");
}

// Default department/team list (seeded once per database).
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
    foreach (default_team_names() as $name) {
        db_insert_ignore($pdo, 'teams', ['name'], [$name]);
    }
}

// Seed the default team list exactly once per database. Using a flag (rather
// than "table is empty") means teams an admin later deletes are not
// resurrected on the next request.
function db_seed_default_teams_once(PDO $pdo): void {
    $stmt = $pdo->prepare('SELECT `value` FROM meta WHERE `key` = ?');
    $stmt->execute(['teams_seeded']);
    if ($stmt->fetchColumn()) {
        return;
    }
    seed_default_teams($pdo);
    if (db_is_mysql()) {
        $pdo->prepare('REPLACE INTO meta (`key`, `value`) VALUES (?, ?)')
            ->execute(['teams_seeded', '1']);
    } else {
        $pdo->prepare('INSERT OR REPLACE INTO meta (`key`, `value`) VALUES (?, ?)')
            ->execute(['teams_seeded', '1']);
    }
}

// Creates the default accounts the first time the database is used. Runs even
// when the schema was imported by hand (phpMyAdmin) instead of created here.
function db_seed_users_if_empty(PDO $pdo): void {
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $hash = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, first_name, last_name, kingschat_phone)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insert->execute(['superadmin', $hash, ROLE_SUPER, 'System', 'Overseer', '2348000000000']);
    $insert->execute(['manager', $hash, ROLE_MANAGER, 'Grace', 'Manager', '2348000000001']);
    $insert->execute(['leader', $hash, ROLE_LEADER, 'David', 'Leader', '2348000000002']);
}
