<?php
// Team management. Any signed-in user can read the list (needed for dropdowns);
// only the Super Admin can create, rename or delete teams.

if (!isset($rest[0])) {
    if ($method === 'GET') {
        require_auth();
        $rows = db()->query(
            'SELECT t.*,
                    (SELECT COUNT(*) FROM officials o WHERE o.team_id = t.id) AS official_count,
                    (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id) AS leader_count
             FROM teams t ORDER BY t.name COLLATE NOCASE'
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
            $r['official_count'] = (int) $r['official_count'];
            $r['leader_count'] = (int) $r['leader_count'];
        }
        unset($r);
        ok($rows);
    }

    if ($method === 'POST') {
        require_super_admin();
        $data = body();
        require_fields($data, ['name']);
        $name = trim((string) $data['name']);
        $exists = db()->prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE');
        $exists->execute([$name]);
        if ($exists->fetchColumn()) {
            fail('A team with that name already exists.', 409);
        }
        db()->prepare('INSERT INTO teams (name) VALUES (?)')->execute([$name]);
        $id = (int) db()->lastInsertId();
        $stmt = db()->prepare('SELECT * FROM teams WHERE id = ?');
        $stmt->execute([$id]);
        ok($stmt->fetch(), 201);
    }

    return false;
}

$id = (int) $rest[0];
$stmt = db()->prepare('SELECT * FROM teams WHERE id = ?');
$stmt->execute([$id]);
$team = $stmt->fetch();
if (!$team) {
    fail('Team not found.', 404);
}

if ($method === 'PUT') {
    require_super_admin();
    $data = body();
    if (!array_key_exists('name', $data)) {
        fail('Nothing to update.', 422);
    }
    $name = trim((string) $data['name']);
    if ($name === '') {
        fail('Team name cannot be empty.', 422);
    }
    $exists = db()->prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE AND id <> ?');
    $exists->execute([$name, $id]);
    if ($exists->fetchColumn()) {
        fail('A team with that name already exists.', 409);
    }
    db()->prepare('UPDATE teams SET name = ? WHERE id = ?')->execute([$name, $id]);
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($method === 'DELETE') {
    require_super_admin();
    // Detach references so officials/leaders are kept but simply unassigned.
    db()->prepare('UPDATE users SET team_id = NULL WHERE team_id = ?')->execute([$id]);
    db()->prepare('UPDATE officials SET team_id = NULL WHERE team_id = ?')->execute([$id]);
    db()->prepare('DELETE FROM teams WHERE id = ?')->execute([$id]);
    ok(['deleted' => true]);
}

return false;
