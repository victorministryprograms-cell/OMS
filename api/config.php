<?php
// Central configuration for the Officials Management System.
//
// Local overrides live in api/config.local.php (never committed). That file is
// loaded first, so anything it defines wins over the defaults below.
//
// Example api/config.local.php for cPanel / MySQL hosting:
//   <?php
//   define('DB_DRIVER', 'mysql');
//   define('DB_HOST', 'localhost');
//   define('DB_NAME', 'cpaneluser_oms');
//   define('DB_USER', 'cpaneluser_oms');
//   define('DB_PASS', 'your-password');
//   define('JWT_SECRET', 'a-long-random-string');

if (is_file(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// Change this secret in production. Used to sign JWTs (HMAC-SHA256).
defined('JWT_SECRET') || define('JWT_SECRET', 'oms-navy-gold-secret-change-me-2026');
defined('JWT_TTL') || define('JWT_TTL', 60 * 60 * 12); // 12 hours

defined('DEFAULT_PASSWORD') || define('DEFAULT_PASSWORD', '1234567890');

// Database driver: 'sqlite' (default, file based) or 'mysql' (cPanel/shared hosting).
defined('DB_DRIVER') || define('DB_DRIVER', 'sqlite');

// SQLite storage (used when DB_DRIVER is 'sqlite').
defined('DB_DIR') || define('DB_DIR', dirname(__DIR__) . '/data');
defined('DB_PATH') || define('DB_PATH', DB_DIR . '/database.db');

// MySQL connection (used when DB_DRIVER is 'mysql').
defined('DB_HOST') || define('DB_HOST', 'localhost');
defined('DB_PORT') || define('DB_PORT', '3306');
defined('DB_NAME') || define('DB_NAME', '');
defined('DB_USER') || define('DB_USER', '');
defined('DB_PASS') || define('DB_PASS', '');
defined('DB_CHARSET') || define('DB_CHARSET', 'utf8mb4');

// Roles used across the system.
const ROLE_SUPER   = 'super_admin';
const ROLE_MANAGER = 'programs_manager';
const ROLE_LEADER  = 'team_leader';

function all_roles(): array {
    return [ROLE_SUPER, ROLE_MANAGER, ROLE_LEADER];
}
