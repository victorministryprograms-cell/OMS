<?php
// Event + roster routes.

function find_event(int $id): array {
    $stmt = db()->prepare('SELECT * FROM events WHERE id = ?');
    $stmt->execute([$id]);
    $event = $stmt->fetch();
    if (!$event) {
        fail('Program not found.', 404);
    }
    return $event;
}

function get_or_create_submission(int $eventId, int $leaderId): array {
    $stmt = db()->prepare('SELECT * FROM submissions WHERE event_id = ? AND team_leader_id = ?');
    $stmt->execute([$eventId, $leaderId]);
    $sub = $stmt->fetch();
    if ($sub) {
        return $sub;
    }
    db()->prepare('INSERT INTO submissions (event_id, team_leader_id, status) VALUES (?, ?, ?)')
        ->execute([$eventId, $leaderId, 'draft']);
    $stmt->execute([$eventId, $leaderId]);
    return $stmt->fetch();
}

function event_counts(int $eventId): array {
    $registered = db()->prepare(
        'SELECT COUNT(*) FROM roster_entries r JOIN submissions s ON r.submission_id = s.id WHERE s.event_id = ?'
    );
    $registered->execute([$eventId]);
    $teams = db()->prepare('SELECT COUNT(*) FROM submissions WHERE event_id = ?');
    $teams->execute([$eventId]);
    $pending = db()->prepare("SELECT COUNT(*) FROM submissions WHERE event_id = ? AND status = 'submitted'");
    $pending->execute([$eventId]);
    return [
        'registered_count' => (int) $registered->fetchColumn(),
        'team_count' => (int) $teams->fetchColumn(),
        'pending_count' => (int) $pending->fetchColumn(),
    ];
}

// ---- POST /events/join/{token} --------------------------------------------
if ($method === 'POST' && ($rest[0] ?? '') === 'join') {
    $user = require_role([ROLE_LEADER]);
    $token = $rest[1] ?? '';
    $stmt = db()->prepare('SELECT * FROM events WHERE token = ?');
    $stmt->execute([$token]);
    $event = $stmt->fetch();
    if (!$event) {
        fail('Invalid program link.', 404);
    }
    $sub = get_or_create_submission((int) $event['id'], (int) $user['id']);
    ok(['event' => $event, 'submission' => $sub]);
}

// ---- Collection: /events ---------------------------------------------------
if (!isset($rest[0])) {
    if ($method === 'GET') {
        $user = require_auth();
        if ($user['role'] === ROLE_LEADER) {
            $stmt = db()->prepare(
                'SELECT e.*, s.id AS submission_id, s.status AS submission_status,
                        (SELECT COUNT(*) FROM roster_entries r WHERE r.submission_id = s.id) AS my_count
                 FROM events e
                 JOIN submissions s ON s.event_id = e.id
                 WHERE s.team_leader_id = ?
                 ORDER BY e.created_at DESC'
            );
            $stmt->execute([$user['id']]);
            ok($stmt->fetchAll());
        }
        $rows = db()->query(
            'SELECT e.*,
                    (SELECT COUNT(*) FROM roster_entries r JOIN submissions s ON r.submission_id = s.id WHERE s.event_id = e.id) AS registered_count,
                    (SELECT COUNT(*) FROM submissions s WHERE s.event_id = e.id) AS team_count,
                    (SELECT COUNT(*) FROM submissions s WHERE s.event_id = e.id AND s.status = \'submitted\') AS pending_count
             FROM events e ORDER BY e.created_at DESC'
        )->fetchAll();
        ok($rows);
    }

    if ($method === 'POST') {
        $user = require_manager();
        $data = body();
        require_fields($data, ['name']);
        $token = make_token();
        $status = $data['status'] ?? 'open';
        if (!in_array($status, ['open', 'closed'], true)) {
            $status = 'open';
        }
        db()->prepare(
            'INSERT INTO events (name, description, venue, event_date, start_time, end_time, token, expected_count, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            trim((string) $data['name']),
            trim((string) ($data['description'] ?? '')),
            trim((string) ($data['venue'] ?? '')),
            trim((string) ($data['event_date'] ?? '')),
            trim((string) ($data['start_time'] ?? '')),
            trim((string) ($data['end_time'] ?? '')),
            $token,
            (int) ($data['expected_count'] ?? 0),
            $status,
            $user['id'],
        ]);
        $event = find_event((int) db()->lastInsertId());
        ok($event, 201);
    }

    return false;
}

// ---- Single event: /events/{id} -------------------------------------------
$event = find_event((int) $rest[0]);
$sub = $rest[1] ?? null;

if ($method === 'GET' && !$sub) {
    $user = require_auth();
    $data = $event;
    $data = array_merge($data, event_counts((int) $event['id']));
    if ($user['role'] === ROLE_LEADER) {
        $s = db()->prepare('SELECT * FROM submissions WHERE event_id = ? AND team_leader_id = ?');
        $s->execute([$event['id'], $user['id']]);
        $entry = $s->fetch();
        if ($entry) {
            $counts = db()->prepare(
                'SELECT COUNT(*) AS total, COALESCE(SUM(approved), 0) AS approved
                 FROM roster_entries WHERE submission_id = ?'
            );
            $counts->execute([$entry['id']]);
            $c = $counts->fetch();
            $entry['official_count'] = (int) $c['total'];
            $entry['approved_count'] = (int) $c['approved'];
        }
        $data['submission'] = $entry ?: null;
        $data['is_participant'] = (bool) $entry;
        $team = db()->prepare('SELECT t.name FROM teams t JOIN users u ON u.team_id = t.id WHERE u.id = ?');
        $team->execute([$user['id']]);
        $data['team_name'] = $team->fetchColumn() ?: null;
    }
    ok($data);
}

if ($method === 'PUT' && !$sub) {
    require_manager();
    $data = body();
    $allowed = ['name', 'description', 'venue', 'event_date', 'start_time', 'end_time', 'expected_count', 'status'];
    $sets = [];
    $vals = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "$f = ?";
            $vals[] = $data[$f];
        }
    }
    if ($sets) {
        $vals[] = $event['id'];
        db()->prepare('UPDATE events SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
    }
    ok(find_event((int) $event['id']));
}

if ($method === 'DELETE' && !$sub) {
    require_manager();
    db()->prepare('DELETE FROM events WHERE id = ?')->execute([$event['id']]);
    ok(['deleted' => true]);
}

// ---- Roster: /events/{id}/roster ------------------------------------------
if ($sub === 'roster') {
    if (!isset($rest[2])) {
        if ($method === 'GET') {
            $user = require_role([ROLE_LEADER]);
            $submission = get_or_create_submission((int) $event['id'], (int) $user['id']);
            $stmt = db()->prepare(
                'SELECT o.*, t.name AS team_name, r.id AS roster_id, r.approved
                 FROM roster_entries r
                 JOIN officials o ON o.id = r.official_id
                 LEFT JOIN teams t ON t.id = o.team_id
                 WHERE r.submission_id = ? ORDER BY o.last_name, o.first_name'
            );
            $stmt->execute([$submission['id']]);
            ok(['submission' => $submission, 'officials' => $stmt->fetchAll()]);
        }
        if ($method === 'POST') {
            $user = require_role([ROLE_LEADER]);
            if ($event['status'] !== 'open') {
                fail('This program is closed for registration.', 409);
            }
            $data = body();
            $submission = get_or_create_submission((int) $event['id'], (int) $user['id']);
            if (in_array($submission['status'], ['submitted', 'approved'], true)) {
                fail('Your roster has been submitted. Ask the manager to request edits.', 409);
            }

            $officialId = isset($data['official_id']) ? (int) $data['official_id'] : 0;
            if ($officialId) {
                $check = db()->prepare('SELECT * FROM officials WHERE id = ? AND owner_id = ?');
                $check->execute([$officialId, $user['id']]);
                if (!$check->fetch()) {
                    fail('Official not found in your records.', 404);
                }
            } else {
                require_fields($data, ['first_name', 'last_name', 'kingschat_phone']);
                if (!valid_phone((string) $data['kingschat_phone'])) {
                    fail('KingsChat phone must start with 234.', 422);
                }
                if (!empty($data['email']) && !valid_email((string) $data['email'])) {
                    fail('Please enter a valid email address.', 422);
                }
                $officialId = insert_official((int) $user['id'], $data);
            }

            try {
                db()->prepare('INSERT INTO roster_entries (submission_id, official_id) VALUES (?, ?)')
                    ->execute([$submission['id'], $officialId]);
            } catch (PDOException $e) {
                fail('This official is already on your roster.', 409);
            }
            ok(['added' => $officialId], 201);
        }
    }

    if ($method === 'DELETE' && isset($rest[2])) {
        $user = require_role([ROLE_LEADER]);
        $submission = get_or_create_submission((int) $event['id'], (int) $user['id']);
        if (in_array($submission['status'], ['submitted', 'approved'], true)) {
            fail('Roster is locked after submission.', 409);
        }
        db()->prepare('DELETE FROM roster_entries WHERE submission_id = ? AND official_id = ?')
            ->execute([$submission['id'], (int) $rest[2]]);
        ok(['removed' => true]);
    }
    return false;
}

// ---- Submit: /events/{id}/submit ------------------------------------------
if ($sub === 'submit' && $method === 'POST') {
    $user = require_role([ROLE_LEADER]);
    $submission = get_or_create_submission((int) $event['id'], (int) $user['id']);
    $count = db()->prepare('SELECT COUNT(*) FROM roster_entries WHERE submission_id = ?');
    $count->execute([$submission['id']]);
    if ((int) $count->fetchColumn() === 0) {
        fail('Add at least one official before submitting.', 422);
    }
    $note = trim((string) (body()['note'] ?? ''));
    // Re-submitting resets any previous per-official approvals.
    db()->prepare('UPDATE roster_entries SET approved = 0 WHERE submission_id = ?')
        ->execute([$submission['id']]);
    db()->prepare("UPDATE submissions SET status = 'submitted', submitted_at = datetime('now'), note = ? WHERE id = ?")
        ->execute([$note, $submission['id']]);
    ok(['submitted' => true]);
}

// ---- Manager: /events/{id}/submissions ------------------------------------
if ($sub === 'submissions' && $method === 'GET') {
    require_manager();
    $stmt = db()->prepare(
        'SELECT s.*, u.first_name, u.last_name, u.username, u.kingschat_phone, t.name AS team_name,
                (SELECT COUNT(*) FROM roster_entries r WHERE r.submission_id = s.id) AS official_count,
                (SELECT COUNT(*) FROM roster_entries r WHERE r.submission_id = s.id AND r.approved = 1) AS approved_count
         FROM submissions s
         JOIN users u ON u.id = s.team_leader_id
         LEFT JOIN teams t ON t.id = u.team_id
         WHERE s.event_id = ? ORDER BY s.submitted_at DESC, s.created_at DESC'
    );
    $stmt->execute([$event['id']]);
    ok($stmt->fetchAll());
}

return false;
