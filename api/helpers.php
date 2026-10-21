<?php
require_once __DIR__ . '/db.php';

// ---- Request / response helpers -------------------------------------------

function send_cors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

function json_out($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function ok($data = null, int $status = 200): void {
    json_out(['ok' => true, 'data' => $data], $status);
}

function fail(string $message, int $status = 400, array $extra = []): void {
    json_out(array_merge(['ok' => false, 'error' => $message], $extra), $status);
}

function body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function q(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}

// ---- Validation ------------------------------------------------------------

function require_fields(array $data, array $fields): void {
    foreach ($fields as $field) {
        $value = $data[$field] ?? null;
        if ($value === null || (is_string($value) && trim($value) === '')) {
            fail("Field '$field' is required.", 422);
        }
    }
}

function valid_phone(string $phone): bool {
    return (bool) preg_match('/^234\d{7,}$/', preg_replace('/\s+/', '', $phone));
}

function valid_email(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

// Resolves a team id that actually exists, or null.
function normalize_team_id($value): ?int {
    if ($value === null || $value === '' || $value === false) {
        return null;
    }
    $id = (int) $value;
    if ($id <= 0) {
        return null;
    }
    $stmt = db()->prepare('SELECT id FROM teams WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetchColumn() ? $id : null;
}

// Finds a team by (case-insensitive) name, creating it when missing.
function resolve_team_name(string $name): ?int {
    $name = trim($name);
    if ($name === '') {
        return null;
    }
    $stmt = db()->prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE');
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    if ($id) {
        return (int) $id;
    }
    db()->prepare('INSERT INTO teams (name) VALUES (?)')->execute([$name]);
    return (int) db()->lastInsertId();
}

// Inserts an official for the given owner from a data array.
// Returns the new official id. Callers should validate first_name/last_name/phone.
function insert_official(int $ownerId, array $data): int {
    db()->prepare(
        'INSERT INTO officials
            (owner_id, title, first_name, last_name, kingschat_phone, kingschat_handle, email, team_id, accommodation, hq_staff_member, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $ownerId,
        trim((string) ($data['title'] ?? '')),
        trim((string) $data['first_name']),
        trim((string) $data['last_name']),
        preg_replace('/\s+/', '', (string) $data['kingschat_phone']),
        trim((string) ($data['kingschat_handle'] ?? '')),
        trim((string) ($data['email'] ?? '')),
        normalize_team_id($data['team_id'] ?? null),
        (int) ($data['accommodation'] ?? 0) ? 1 : 0,
        (int) ($data['hq_staff_member'] ?? 0) ? 1 : 0,
        trim((string) ($data['role'] ?? '')),
    ]);
    return (int) db()->lastInsertId();
}

// ---- Misc ------------------------------------------------------------------

function make_token(): string {
    return bin2hex(random_bytes(16));
}

function current_uri_path(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return '/' . trim($path, '/');
}

// Public shape of a user (never exposes password_hash).
function user_public(array $u): array {
    return [
        'id' => (int) $u['id'],
        'username' => $u['username'],
        'role' => $u['role'],
        'first_name' => $u['first_name'],
        'last_name' => $u['last_name'],
        'kingschat_phone' => $u['kingschat_phone'],
        'team_id' => isset($u['team_id']) && $u['team_id'] !== null ? (int) $u['team_id'] : null,
        'team_name' => $u['team_name'] ?? null,
        'must_change_password' => (bool) $u['must_change_password'],
        'active' => (bool) $u['active'],
        'created_at' => $u['created_at'],
    ];
}
