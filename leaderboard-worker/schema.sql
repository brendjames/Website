-- D1 schema for the arcade leaderboard.
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- fast top-N-per-game reads
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (game, score DESC, created_at ASC);
