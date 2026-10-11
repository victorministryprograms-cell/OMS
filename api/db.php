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
    $additions = [
        'officials' => [
            'kingschat_handle' => "ALTER TABLE officials ADD COLUMN kingschat_handle TEXT NOT NULL DEFAULT ''",
            'accommodation'    => 'ALTER TABLE officials ADD COLUMN accommodation INTEGER NOT NULL DEFAULT 0',
            'hq_staff_member'  => 'ALTER TABLE officials ADD COLUMN hq_staff_member INTEGER NOT NULL DEFAULT 0',
        ],
        'roster_entries' => [
            'approved' => 'ALTER TABLE roster_entries ADD COLUMN approved INTEGER NOT NULL DEFAULT 0',
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
    CREATE TABLE users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL,
        first_name    TEXT NOT NULL DEFAULT '',
        last_name     TEXT NOT NULL DEFAULT '',
        kingschat_phone TEXT NOT NULL DEFAULT '',
        must_change_password INTEGER NOT NULL DEFAULT 1,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
        accommodation INTEGER NOT NULL DEFAULT 0,
        hq_staff_member INTEGER NOT NULL DEFAULT 0,
        role          TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
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

function db_seed(PDO $pdo): void {
    $hash = password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, first_name, last_name, kingschat_phone)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $insert->execute(['superadmin', $hash, ROLE_SUPER, 'System', 'Overseer', '2348000000000']);
    $insert->execute(['manager', $hash, ROLE_MANAGER, 'Grace', 'Manager', '2348000000001']);
    $insert->execute(['leader', $hash, ROLE_LEADER, 'David', 'Leader', '2348000000002']);
}
