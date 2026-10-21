<?php
// Dev-server / Apache front controller.
// Static files are served directly (with no-cache headers); everything under /api goes to the REST API.

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$target = __DIR__ . $uri;

// Never expose the database directory or database files.
if (preg_match('#^/data/#', $uri) || preg_match('#\.(sqlite|sqlite3|db)$#i', $uri)) {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo 'Forbidden';
    return true;
}

if ($uri !== '/' && !is_dir($target) && file_exists($target)) {
    // Serve static assets ourselves so they are never cached by the browser.
    $mimes = [
        'html' => 'text/html',
        'htm' => 'text/html',
        'txt' => 'text/plain',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'map' => 'application/json',
    ];
    $ext = strtolower(pathinfo($target, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    readfile($target);
    return true;
}

if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

// SPA fallback.
header('Content-Type: text/html');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
readfile(__DIR__ . '/index.html');
return true;
