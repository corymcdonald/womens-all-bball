-- Add configurable settings to waitlists
ALTER TABLE waitlists
  ADD COLUMN max_wins int NOT NULL DEFAULT 2,
  ADD COLUMN game_duration_minutes int NOT NULL DEFAULT 5,
  ADD COLUMN current_streak int NOT NULL DEFAULT 0;

-- Snapshot settings onto each game so mid-session changes don't affect in-progress games
ALTER TABLE games
  ADD COLUMN max_wins int NOT NULL DEFAULT 2,
  ADD COLUMN game_duration_minutes int NOT NULL DEFAULT 5;
