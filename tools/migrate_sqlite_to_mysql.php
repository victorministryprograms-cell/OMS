<?php
/**
 * Move OMS data from SQLite into MySQL.
 *
 * Two modes:
 *
 *   1) Dump (runs anywhere, no MySQL needed):
 *        php tools/migrate_sqlite_to_mysql.php dump data/database.db data/oms_dump.sql
 *      Produces a .sql file you can import in phpMyAdmin.
 *
 *   2) Import (runs where pdo_mysql is available, e.g. on the server):
 *        php tools/migrate_sqlite_to_mysql.php import data/database.db
 *      Copies the rows straight into the MySQL database configured in
 *      api/config.local.php (DB_DRIVER must be 'mysql').
 *
 * The target schema is created automatically before the import.
 */

$mode = $argv[1] ?? '';
$sqlitePath = $argv[2] ?? (dirname(__DIR__) . '/data/database.db');
$outPath = $argv[3] ?? (dirname(__DIR__) . '/data/oms_dump.sql');

if (!in_array($mode, ['dump', 'import'], true)) {
    fwrite(STDERR, "Usage:\n"
        . "  php tools/migrate_sqlite_to_mysql.php dump  [sqlite.db] [out.sql]\n"
        . "  php tools/migrate_sqlite_to_mysql.php import [sqlite.db]\n");
    exit(1);
}

if (!is_file($sqlitePath)) {
    fwrite(STDERR, "SQLite database not found: $sqlitePath\n");
    exit(1);
}

// Tables in the order they must be inserted (parents before children).
const TABLES = ['teams', 'users', 'events', 'officials', 'submissions', 'roster_entries', 'meta'];

function sqlite_pdo(string $path): PDO {
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

/** Escapes a value for a MySQL single quoted string literal. */
function mysql_literal($value): string {
    if ($value === null) {
        return 'NULL';
    }
    if (is_int($value) || is_float($value)) {
        return (string) $value;
    }
    if (is_bool($value)) {
        return $value ? '1' : '0';
    }
    $value = str_replace(
        ["\\", "'", "\x00", "\n", "\r", "\x1a"],
        ["\\\\", "''", "\\0", "\\n", "\\r", "\\Z"],
        (string) $value
    );
    return "'" . $value . "'";
}

/** Column list of a table, in declaration order. */
function table_columns(PDO $src, string $table): array {
    $rows = $src->query('PRAGMA table_info(' . $table . ')')->fetchAll();
    return array_column($rows ?: [], 'name');
}

function read_rows(PDO $src, string $table): array {
    return $src->query('SELECT * FROM ' . $table)->fetchAll();
}

$src = sqlite_pdo($sqlitePath);

if ($mode === 'dump') {
    $fh = fopen($outPath, 'w');
    if (!$fh) {
        fwrite(STDERR, "Cannot write to $outPath\n");
        exit(1);
    }
    fwrite($fh, "-- OMS data dump generated from SQLite\n");
    fwrite($fh, "-- Source: " . basename($sqlitePath) . "\n\n");
    fwrite($fh, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET time_zone = '+00:00';\n\n");

    foreach (TABLES as $table) {
        $columns = table_columns($src, $table);
        if (!$columns) {
            continue;
        }
        $rows = read_rows($src, $table);
        if (!$rows) {
            continue;
        }
        $cols = '`' . implode('`, `', $columns) . '`';
        $values = [];
        foreach ($rows as $row) {
            $cells = [];
            foreach ($columns as $column) {
                $cells[] = mysql_literal($row[$column] ?? null);
            }
            $values[] = '(' . implode(', ', $cells) . ')';
        }
        fwrite($fh, "INSERT INTO `$table` ($cols) VALUES\n");
        fwrite($fh, implode(",\n", $values) . ";\n\n");
        echo "dumped $table: " . count($rows) . " rows\n";
    }

    fwrite($fh, "SET FOREIGN_KEY_CHECKS = 1;\n");
    fclose($fh);
    echo "\nWrote $outPath\n";
    exit(0);
}

// ---- import mode ------------------------------------------------------------

require_once dirname(__DIR__) . '/api/db.php';

if (db_driver() !== 'mysql') {
    fwrite(STDERR, "DB_DRIVER must be 'mysql' for import mode. Set it in api/config.local.php\n");
    exit(1);
}

$target = db(); // connects to MySQL and creates the schema if needed

$target->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach (array_reverse(TABLES) as $table) {
    $target->exec('DELETE FROM `' . $table . '`');
}

$target->beginTransaction();
try {
    foreach (TABLES as $table) {
        $columns = table_columns($src, $table);
        if (!$columns) {
            continue;
        }
        $rows = read_rows($src, $table);
        if (!$rows) {
            echo "skipped $table: no rows\n";
            continue;
        }
        $cols = '`' . implode('`, `', $columns) . '`';
        $place = implode(',', array_fill(0, count($columns), '?'));
        $stmt = $target->prepare("INSERT INTO `$table` ($cols) VALUES ($place)");
        foreach ($rows as $row) {
            $stmt->execute(array_map(
                fn($c) => $row[$c] ?? null,
                $columns
            ));
        }
        echo "imported $table: " . count($rows) . " rows\n";
    }
    $target->commit();
} catch (Throwable $e) {
    $target->rollBack();
    fwrite(STDERR, "Import failed: " . $e->getMessage() . "\n");
    exit(1);
}
$target->exec('SET FOREIGN_KEY_CHECKS = 1');

echo "\nDone. Data is now in MySQL database " . DB_NAME . "\n";
