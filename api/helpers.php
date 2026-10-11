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
        'must_change_password' => (bool) $u['must_change_password'],
        'active' => (bool) $u['active'],
        'created_at' => $u['created_at'],
    ];
}
