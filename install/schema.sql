-- OMS (Officials Management System) - MySQL / MariaDB schema
--
-- Import this file in phpMyAdmin to create the tables by hand.
-- It is optional: the application creates the same tables automatically on the
-- first request, and it also adds any missing columns on later requests.
--
-- Character set utf8mb4 (full Unicode) with utf8mb4_unicode_ci, which is the
-- case-insensitive collation used for usernames and team names.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS teams (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name       VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_teams_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username      VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32) NOT NULL,
    first_name    VARCHAR(191) NOT NULL DEFAULT '',
    last_name     VARCHAR(191) NOT NULL DEFAULT '',
    kingschat_phone VARCHAR(32) NOT NULL DEFAULT '',
    team_id       INT UNSIGNED NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    KEY idx_users_team (team_id),
    CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(191) NOT NULL,
    description   TEXT NOT NULL,
    venue         VARCHAR(191) NOT NULL DEFAULT '',
    event_date    VARCHAR(20) NOT NULL DEFAULT '',
    start_time    VARCHAR(20) NOT NULL DEFAULT '',
    end_time      VARCHAR(20) NOT NULL DEFAULT '',
    token         VARCHAR(64) NOT NULL,
    expected_count INT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'open',
    created_by    INT UNSIGNED NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_events_token (token),
    KEY idx_events_created_by (created_by),
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS officials (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_id      INT UNSIGNED NOT NULL,
    title         VARCHAR(100) NOT NULL DEFAULT '',
    first_name    VARCHAR(191) NOT NULL,
    last_name     VARCHAR(191) NOT NULL,
    kingschat_phone VARCHAR(32) NOT NULL,
    kingschat_handle VARCHAR(191) NOT NULL DEFAULT '',
    email         VARCHAR(191) NOT NULL DEFAULT '',
    team_id       INT UNSIGNED NULL,
    accommodation TINYINT(1) NOT NULL DEFAULT 0,
    hq_staff_member TINYINT(1) NOT NULL DEFAULT 0,
    role          VARCHAR(191) NOT NULL DEFAULT '',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_officials_owner (owner_id),
    KEY idx_officials_team (team_id),
    CONSTRAINT fk_officials_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_officials_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id      INT UNSIGNED NOT NULL,
    team_leader_id INT UNSIGNED NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    note          VARCHAR(1000) NOT NULL DEFAULT '',
    review_note   VARCHAR(1000) NOT NULL DEFAULT '',
    reviewed_by   INT UNSIGNED NULL,
    submitted_at  DATETIME NULL,
    reviewed_at   DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_submissions_event_leader (event_id, team_leader_id),
    KEY idx_submissions_leader (team_leader_id),
    CONSTRAINT fk_submissions_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_leader FOREIGN KEY (team_leader_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roster_entries (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    submission_id INT UNSIGNED NOT NULL,
    official_id   INT UNSIGNED NOT NULL,
    approved      TINYINT(1) NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roster_submission_official (submission_id, official_id),
    KEY idx_roster_official (official_id),
    CONSTRAINT fk_roster_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_roster_official FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta (
    `key`   VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
