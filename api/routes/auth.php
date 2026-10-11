<?php
// Auth routes: login, profile, password change.

if ($method === 'POST' && ($rest[0] ?? '') === 'login') {
    $data = body();
    require_fields($data, ['username', 'password']);

    $username = trim((string) $data['username']);
    $role = $data['role'] ?? null;

    $stmt = db()->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify((string) $data['password'], $user['password_hash'])) {
        fail('Invalid username or password.', 401);
    }
    if (!$user['active']) {
        fail('This account has been disabled.', 403);
    }
    if ($role && in_array($role, all_roles(), true) && $role !== $user['role']) {
        fail('Selected privilege does not match this account.', 403);
    }

    $token = jwt_encode([
        'sub' => (int) $user['id'],
        'role' => $user['role'],
        'username' => $user['username'],
    ]);
    ok(['token' => $token, 'user' => user_public($user)]);
}

if ($method === 'GET' && ($rest[0] ?? '') === 'me') {
    $user = require_auth();
    ok(user_public($user));
}

if ($method === 'POST' && ($rest[0] ?? '') === 'update-profile') {
    $user = require_auth();
    $data = body();
    if (!array_key_exists('username', $data)) {
        fail('Nothing to update.', 422);
    }
    $username = trim((string) $data['username']);
    if ($username === '') {
        fail('Username cannot be empty.', 422);
    }
    if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
        fail('Username must be 3-50 characters: letters, numbers, dots, dashes or underscores.', 422);
    }
    if (strcasecmp($username, $user['username']) !== 0) {
        $chk = db()->prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?');
        $chk->execute([$username, $user['id']]);
        if ($chk->fetch()) {
            fail('That username is already taken.', 409);
        }
        db()->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$username, $user['id']]);
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    ok(user_public($stmt->fetch()));
}

if ($method === 'POST' && ($rest[0] ?? '') === 'change-password') {
    $user = require_auth();
    $data = body();
    require_fields($data, ['current_password', 'new_password']);

    if (!password_verify((string) $data['current_password'], $user['password_hash'])) {
        fail('Current password is incorrect.', 422);
    }
    $new = (string) $data['new_password'];
    if (strlen($new) < 6) {
        fail('New password must be at least 6 characters.', 422);
    }
    $stmt = db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
    $stmt->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
    ok(['updated' => true]);
}

return false;
