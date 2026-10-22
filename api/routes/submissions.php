<?php
// Submission review (Programs Manager / Super Admin).

require_manager();

if (!isset($rest[0])) {
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT s.*, e.name AS event_name, e.event_date, u.first_name, u.last_name, u.username, t.name AS team_name,
                    (SELECT COUNT(*) FROM roster_entries r WHERE r.submission_id = s.id) AS official_count,
                    (SELECT COUNT(*) FROM roster_entries r WHERE r.submission_id = s.id AND r.approved = 1) AS approved_count
             FROM submissions s
             JOIN events e ON e.id = s.event_id
             JOIN users u ON u.id = s.team_leader_id
             LEFT JOIN teams t ON t.id = u.team_id
             ORDER BY s.submitted_at DESC, s.created_at DESC'
        );
        ok($stmt->fetchAll());
    }
    return false;
}

$id = (int) $rest[0];
$action = $rest[1] ?? '';

$stmt = db()->prepare(
    'SELECT s.*, e.name AS event_name, e.expected_count, u.first_name, u.last_name, u.username, t.name AS team_name
     FROM submissions s
     JOIN events e ON e.id = s.event_id
     JOIN users u ON u.id = s.team_leader_id
     LEFT JOIN teams t ON t.id = u.team_id
     WHERE s.id = ?'
);
$stmt->execute([$id]);
$submission = $stmt->fetch();
if (!$submission) {
    fail('Submission not found.', 404);
}

if ($method === 'GET' && $action === '') {
    $officials = db()->prepare(
        'SELECT o.*, t.name AS team_name, r.id AS roster_id, r.approved
         FROM roster_entries r
         JOIN officials o ON o.id = r.official_id
         LEFT JOIN teams t ON t.id = o.team_id
         WHERE r.submission_id = ? ORDER BY o.last_name, o.first_name'
    );
    $officials->execute([$id]);
    $submission['officials'] = $officials->fetchAll();
    $submission['approved_count'] = count(array_filter($submission['officials'], function ($o) {
        return (int) $o['approved'] === 1;
    }));
    ok($submission);
}

if ($method === 'POST' && $action === 'approve') {
    $me = current_user();
    $data = body();
    $ids = $data['roster_ids'] ?? null;

    if (!is_array($ids)) {
        // No selection supplied: approve the whole roster.
        $stmt = db()->prepare('SELECT id FROM roster_entries WHERE submission_id = ?');
        $stmt->execute([$id]);
        $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    db()->prepare('UPDATE roster_entries SET approved = 0 WHERE submission_id = ?')->execute([$id]);
    if ($ids) {
        $ids = array_map('intval', $ids);
        $place = implode(',', array_fill(0, count($ids), '?'));
        db()->prepare("UPDATE roster_entries SET approved = 1 WHERE submission_id = ? AND id IN ($place)")
            ->execute(array_merge([$id], $ids));
    }

    db()->prepare("UPDATE submissions SET status = 'approved', reviewed_by = ?, reviewed_at = " . sql_now() . ", review_note = '' WHERE id = ?")
        ->execute([$me['id'], $id]);

    $count = db()->prepare('SELECT COUNT(*) FROM roster_entries WHERE submission_id = ? AND approved = 1');
    $count->execute([$id]);
    ok(['approved' => true, 'approved_count' => (int) $count->fetchColumn()]);
}

if ($method === 'POST' && $action === 'request-revision') {
    $me = current_user();
    $note = trim((string) (body()['note'] ?? ''));
    if ($note === '') {
        fail('Please describe the requested changes.', 422);
    }
    db()->prepare("UPDATE submissions SET status = 'revision', reviewed_by = ?, reviewed_at = " . sql_now() . ", review_note = ? WHERE id = ?")
        ->execute([$me['id'], $note, $id]);
    ok(['revision_requested' => true]);
}

return false;
