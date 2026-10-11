<?php
// Team leader's personal official records (historical officials).

$user = require_role([ROLE_LEADER]);

if (!isset($rest[0])) {
    if ($method === 'GET') {
        $search = trim((string) q('search', ''));
        if ($search !== '') {
            $stmt = db()->prepare(
                'SELECT * FROM officials WHERE owner_id = ?
                 AND (first_name LIKE ? OR last_name LIKE ? OR kingschat_phone LIKE ?
                      OR kingschat_handle LIKE ? OR role LIKE ?)
                 ORDER BY last_name, first_name'
            );
            $like = '%' . $search . '%';
            $stmt->execute([$user['id'], $like, $like, $like, $like, $like]);
        } else {
            $stmt = db()->prepare('SELECT * FROM officials WHERE owner_id = ? ORDER BY last_name, first_name');
            $stmt->execute([$user['id']]);
        }
        ok($stmt->fetchAll());
    }

    if ($method === 'POST') {
        $data = body();
        require_fields($data, ['first_name', 'last_name', 'kingschat_phone']);
        if (!valid_phone((string) $data['kingschat_phone'])) {
            fail('KingsChat phone must start with 234.', 422);
        }
        db()->prepare(
            'INSERT INTO officials
                (owner_id, title, first_name, last_name, kingschat_phone, kingschat_handle, accommodation, hq_staff_member, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $user['id'],
            trim((string) ($data['title'] ?? '')),
            trim((string) $data['first_name']),
            trim((string) $data['last_name']),
            preg_replace('/\s+/', '', (string) $data['kingschat_phone']),
            trim((string) ($data['kingschat_handle'] ?? '')),
            (int) ($data['accommodation'] ?? 0),
            (int) ($data['hq_staff_member'] ?? 0),
            trim((string) ($data['role'] ?? '')),
        ]);
        $id = (int) db()->lastInsertId();
        $stmt = db()->prepare('SELECT * FROM officials WHERE id = ?');
        $stmt->execute([$id]);
        ok($stmt->fetch(), 201);
    }
    return false;
}

$id = (int) $rest[0];
$stmt = db()->prepare('SELECT * FROM officials WHERE id = ? AND owner_id = ?');
$stmt->execute([$id, $user['id']]);
$official = $stmt->fetch();
if (!$official) {
    fail('Official not found.', 404);
}

if ($method === 'PUT') {
    $data = body();
    $allowed = ['title', 'first_name', 'last_name', 'kingschat_phone', 'kingschat_handle', 'accommodation', 'hq_staff_member', 'role'];
    $sets = [];
    $vals = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            if ($f === 'kingschat_phone' && !valid_phone((string) $data[$f])) {
                fail('KingsChat phone must start with 234.', 422);
            }
            $sets[] = "$f = ?";
            if ($f === 'kingschat_phone') {
                $vals[] = preg_replace('/\s+/', '', (string) $data[$f]);
            } elseif ($f === 'accommodation' || $f === 'hq_staff_member') {
                $vals[] = (int) $data[$f];
            } else {
                $vals[] = $data[$f];
            }
        }
    }
    if ($sets) {
        $vals[] = $id;
        db()->prepare('UPDATE officials SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    $stmt->execute([$id, $user['id']]);
    ok($stmt->fetch());
}

if ($method === 'DELETE') {
    db()->prepare('DELETE FROM officials WHERE id = ?')->execute([$id]);
    ok(['deleted' => true]);
}

return false;
