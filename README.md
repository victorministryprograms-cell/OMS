# OMS

Officials Management System — a procedural PHP + REST API with a vanilla JS single-page app.

Programs managers create programs and share invite links; team leaders register their officials and submit rosters; managers review and approve officials.

The app supports two database drivers: **SQLite** (default, zero setup, used for development) and **MySQL/MariaDB** (used for cPanel hosting).

## Requirements

- PHP 8 with PDO
- SQLite driver: `pdo_sqlite` (development)
- MySQL driver: `pdo_mysql` (production / cPanel)
- A web server (Apache) or PHP's built-in server for development

## Run (development)

```bash
php -S 127.0.0.1:8000 router.php
```

Then open http://127.0.0.1:8000.

## Storage

Data is stored in SQLite at `data/database.db` (created and seeded automatically on first run). This directory is not committed.

To use MySQL instead, see [Hosting on cPanel (MySQL)](#hosting-on-cpanel-mysql).

## Configuration

All settings live in `api/config.php`. Anything there can be overridden per server by creating `api/config.local.php` (git-ignored, never committed):

```php
<?php
define('DB_DRIVER', 'mysql');
define('DB_HOST', 'localhost');
define('DB_NAME', 'cpaneluser_oms');
define('DB_USER', 'cpaneluser_oms');
define('DB_PASS', 'your-password');
define('JWT_SECRET', 'a-long-random-string');
```

`api/config.local.php` is loaded first, so its values win. Leave it out entirely to stay on SQLite.

## Hosting on cPanel (MySQL)

1. **Create the database.** In cPanel → MySQL Databases, create a database and a user with `ALL PRIVILEGES`. cPanel prefixes both names, e.g. database `cpaneluser_oms` and user `cpaneluser_oms`.
2. **Upload the app.** Upload the project to `public_html` (or a subfolder). Keep this layout:

   ```
   public_html/
     index.html
     assets/
     api/
     router.php            (only if you are not using .htaccess rewrite)
     .htaccess
     install/              (optional, can be deleted after setup)
   ```

3. **Point the app at MySQL.** Create `api/config.local.php` in the uploaded files with the credentials from step 1 (see the example above). Also set a strong `JWT_SECRET`.
4. **Make sure the schema exists.** Either import `install/schema.sql` in phpMyAdmin, or just open the app — the tables, the default team list and the default accounts are created automatically on the first request. Importing the file first is optional.
5. **Default accounts** (change the password after the first login):

   | Username     | Role             | Password     |
   |--------------|------------------|--------------|
   | `superadmin` | Super Admin      | `1234567890` |
   | `manager`    | Programs Manager | `1234567890` |
   | `leader`     | Team Leader      | `1234567890` |

6. **Permissions.** The `data/` directory is only needed for SQLite and can be removed (or left empty) on MySQL hosting. Make sure `api/` and `assets/` are readable, and that the app directory is not writable by the browser if you can avoid it.
7. **PHP version.** Select PHP 8.x for the domain in cPanel → MultiPHP Manager, and confirm `pdo_mysql` is enabled (cPanel → Select PHP Version → extensions).
8. **HTTPS.** Turn on "Force HTTPS" in cPanel → Domains so the app is served over TLS.

### Moving existing SQLite data into MySQL

The data currently in `data/database.db` can be moved over:

- **Option A — generate a dump, then import it in phpMyAdmin** (works from a machine without `pdo_mysql`):

  ```bash
  php tools/migrate_sqlite_to_mysql.php dump data/database.db data/oms_dump.sql
  ```

  Upload `data/oms_dump.sql` and import it in phpMyAdmin (Import tab). Do this *before* the app creates the schema, or delete the imported rows first — the dump replaces the tables' contents.

- **Option B — import directly on the server** (needs `pdo_mysql` where the command runs, e.g. over SSH):

  ```bash
  php tools/migrate_sqlite_to_mysql.php import data/database.db
  ```

  This creates the schema if needed, clears the target tables and copies every row in one transaction. The database it writes to is the one configured in `api/config.local.php` (`DB_DRIVER` must be `mysql`).

### Notes

- Timestamps are stored in UTC on both drivers (`UTC_TIMESTAMP()` on MySQL, `datetime('now')` on SQLite) and the MySQL session time zone is pinned to `+00:00`.
- Team names and usernames are compared case-insensitively on both drivers (`LOWER()` instead of SQLite's `COLLATE NOCASE`).
- `meta.key` is a reserved word in MySQL, so that column is always written with backticks.
