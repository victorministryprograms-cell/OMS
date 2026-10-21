<?php
// User management (Super Admin only).

require_super_admin();

if ($method === 'GET' && !isset($rest[0])) {
    $rows = db()->query(
        'SELECT u.*, t.name AS team_name FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
         ORDER BY u.role, u.username'
    )->fetchAll();
    ok(array_map('user_public', $rows));
}

if ($method === 'POST' && !isset($rest[0])) {
    $data = body();
    require_fields($data, ['username', 'role']);
    if (!in_array($data['role'], all_roles(), true)) {
        fail('Invalid role.', 422);
    }
    $password = (string) ($data['password'] ?? DEFAULT_PASSWORD);
    $teamId = $data['role'] === ROLE_LEADER ? normalize_team_id($data['team_id'] ?? null) : null;
    $stmt = db()->prepare(
        'INSERT INTO users (username, password_hash, role, first_name, last_name, kingschat_phone, team_id, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
    );
    try {
        $stmt->execute([
            trim((string) $data['username']),
            password_hash($password, PASSWORD_DEFAULT),
            $data['role'],
            trim((string) ($data['first_name'] ?? '')),
            trim((string) ($data['last_name'] ?? '')),
            trim((string) ($data['kingschat_phone'] ?? '')),
            $teamId,
        ]);
    } catch (PDOException $e) {
        fail('Username already exists.', 409);
    }
    $created = db()->prepare('SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE u.id = ?');
    $created->execute([(int) db()->lastInsertId()]);
    ok(user_public($created->fetch()), 201);
}

if ($method === 'PUT' && isset($rest[0])) {
    $data = body();
    $id = (int) $rest[0];
    $fields = ['first_name', 'last_name', 'kingschat_phone', 'role', 'active'];
    $sets = [];
    $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "$f = ?";
            $vals[] = is_bool($data[$f]) ? (int) $data[$f] : $data[$f];
        }
    }
    if (array_key_exists('team_id', $data)) {
        $sets[] = 'team_id = ?';
        $vals[] = normalize_team_id($data['team_id']);
    }
    if (!$sets) {
        fail('Nothing to update.', 422);
    }
    $vals[] = $id;
    db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    $row = db()->prepare('SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE u.id = ?');
    $row->execute([$id]);
    ok(user_public($row->fetch()));
}

if ($method === 'POST' && ($rest[1] ?? '') === 'reset-password') {
    $id = (int) $rest[0];
    db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
        ->execute([password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT), $id]);
    ok(['reset' => true]);
}

if ($method === 'DELETE' && isset($rest[0])) {
    $id = (int) $rest[0];
    $me = require_auth();
    if ($id === (int) $me['id']) {
        fail('You cannot delete your own account.', 422);
    }
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    ok(['deleted' => true]);
}

return false;
