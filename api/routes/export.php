<?php
// CSV export of a finalized event roster (Manager / Super Admin).

require_manager();

if ($method === 'GET' && ($rest[0] ?? '') === 'event' && isset($rest[1])) {
    $eventId = (int) $rest[1];
    $stmt = db()->prepare('SELECT * FROM events WHERE id = ?');
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();
    if (!$event) {
        fail('Program not found.', 404);
    }

    $rows = db()->prepare(
        'SELECT u.first_name AS leader_first, u.last_name AS leader_last, u.kingschat_phone AS leader_phone,
                o.title, o.first_name, o.last_name, o.kingschat_phone, o.kingschat_handle,
                o.accommodation, o.hq_staff_member, s.status
         FROM roster_entries r
         JOIN submissions s ON s.id = r.submission_id
         JOIN users u ON u.id = s.team_leader_id
         JOIN officials o ON o.id = r.official_id
         WHERE s.event_id = ?
         ORDER BY u.last_name, u.first_name, o.last_name, o.first_name'
    );
    $rows->execute([$eventId]);

    $safeName = preg_replace('/[^A-Za-z0-9_-]+/', '_', $event['name']);
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"roster_{$safeName}.csv\"");

    $out = fopen('php://output', 'w');
    fputcsv($out, ['Team Leader', 'Leader Phone', 'Title', 'First Name', 'Last Name', 'KINGSCHAT Phone', 'KINGSCHAT Handle', 'Accommodation', 'HQ Staff Member', 'Status']);
    foreach ($rows->fetchAll() as $r) {
        fputcsv($out, [
            trim($r['leader_first'] . ' ' . $r['leader_last']),
            $r['leader_phone'],
            $r['title'],
            $r['first_name'],
            $r['last_name'],
            $r['kingschat_phone'],
            $r['kingschat_handle'],
            $r['accommodation'] ? 'Yes' : 'No',
            $r['hq_staff_member'] ? 'Yes' : 'No',
            $r['status'],
        ]);
    }
    fclose($out);
    exit;
}

return false;
