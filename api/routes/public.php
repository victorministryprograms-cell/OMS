<?php
// Public (unauthenticated) event landing details by token.

if ($method === 'GET' && ($rest[0] ?? '') === 'event' && isset($rest[1])) {
    $stmt = db()->prepare(
        'SELECT id, name, description, venue, event_date, start_time, end_time, expected_count, status
         FROM events WHERE token = ?'
    );
    $stmt->execute([$rest[1]]);
    $event = $stmt->fetch();
    if (!$event) {
        fail('Invalid program link.', 404);
    }
    ok($event);
}

return false;
