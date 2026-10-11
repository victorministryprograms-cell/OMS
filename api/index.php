<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/middleware.php';

send_cors();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = current_uri_path();                 // /api/events/5/roster
$segments = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));

// Drop the leading "api" segment when present.
if (($segments[0] ?? '') === 'api') {
    array_shift($segments);
}

$resource = $segments[0] ?? '';
$rest = array_slice($segments, 1);

try {
    $handled = match ($resource) {
        'auth'        => require __DIR__ . '/routes/auth.php',
        'users'       => require __DIR__ . '/routes/users.php',
        'events'      => require __DIR__ . '/routes/events.php',
        'officials'   => require __DIR__ . '/routes/officials.php',
        'submissions' => require __DIR__ . '/routes/submissions.php',
        'public'      => require __DIR__ . '/routes/public.php',
        'export'      => require __DIR__ . '/routes/export.php',
        default       => false,
    };
    if (!$handled) {
        fail('Endpoint not found.', 404);
    }
} catch (Throwable $e) {
    fail('Server error: ' . $e->getMessage(), 500);
}
