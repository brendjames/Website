-- MySQL schema for the arcade leaderboard.
-- Import via cPanel > phpMyAdmin > (your database) > Import.

CREATE TABLE IF NOT EXISTS scores (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game       VARCHAR(20)  NOT NULL,
  name       VARCHAR(3)   NOT NULL,
  score      INT UNSIGNED NOT NULL,
  created_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_rank (game, score, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
