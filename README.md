# OMS

Officials Management System — a procedural PHP + SQLite REST API with a vanilla JS single-page app.

Programs managers create programs and share invite links; team leaders register their officials and submit rosters; managers review and approve officials.

## Requirements

- PHP 8 with the PDO SQLite extension
- A web server (Apache) or PHP's built-in server for development

## Run (development)

```bash
php -S 127.0.0.1:8000 router.php
```

Then open http://127.0.0.1:8000.

## Storage

Data is stored in SQLite at `data/database.db` (created and seeded automatically on first run). This directory is not committed.
