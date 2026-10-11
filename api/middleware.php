<?php
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/helpers.php';

// ---- Auth middleware -------------------------------------------------------

function bearer_token(): ?string {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
        return trim($m[1]);
    }
    return null;
}

// Resolves the JWT to a fresh DB user, or fails the request.
function current_user(): array {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $token = bearer_token();
    if (!$token) {
        fail('Authentication required.', 401);
    }
    $payload = jwt_decode($token);
    if (!$payload || empty($payload['sub'])) {
        fail('Invalid or expired session.', 401);
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([(int) $payload['sub']]);
    $user = $stmt->fetch();
    if (!$user || !$user['active']) {
        fail('Account not found or disabled.', 401);
    }
    $cached = $user;
    return $cached;
}

function require_auth(): array {
    return current_user();
}

function require_role(array $roles): array {
    $user = current_user();
    if (!in_array($user['role'], $roles, true)) {
        fail('You do not have permission to perform this action.', 403);
    }
    return $user;
}

function require_super_admin(): array {
    return require_role([ROLE_SUPER]);
}

function require_manager(): array {
    return require_role([ROLE_SUPER, ROLE_MANAGER]);
}
