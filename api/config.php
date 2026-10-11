<?php
// Central configuration for the Officials Management System.

// Change this secret in production. Used to sign JWTs (HMAC-SHA256).
const JWT_SECRET = 'oms-navy-gold-secret-change-me-2026';
const JWT_TTL    = 60 * 60 * 12; // 12 hours

const DEFAULT_PASSWORD = '1234567890';

// Absolute path to the SQLite database file (persistent storage).
define('DB_DIR', dirname(__DIR__) . '/data');
define('DB_PATH', DB_DIR . '/database.db');

// Roles used across the system.
const ROLE_SUPER   = 'super_admin';
const ROLE_MANAGER = 'programs_manager';
const ROLE_LEADER  = 'team_leader';

function all_roles(): array {
    return [ROLE_SUPER, ROLE_MANAGER, ROLE_LEADER];
}
