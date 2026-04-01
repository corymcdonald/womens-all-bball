-- Users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Waitlists
CREATE TABLE waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passcode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Waitlist players
CREATE TABLE waitlist_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES waitlists(id),
  user_id uuid NOT NULL REFERENCES users(id),
  priority int,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'playing', 'absent', 'left', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active row per user per waitlist
CREATE UNIQUE INDEX waitlist_players_active_unique
  ON waitlist_players (waitlist_id, user_id)
  WHERE status IN ('waiting', 'playing', 'absent');

-- Teams
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team players
CREATE TABLE team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Games
CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES waitlists(id),
  team1_id uuid NOT NULL REFERENCES teams(id),
  team2_id uuid NOT NULL REFERENCES teams(id),
  winner_id uuid REFERENCES teams(id),
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX waitlist_players_queue_order
  ON waitlist_players (waitlist_id, priority NULLS LAST, created_at)
  WHERE status = 'waiting';

CREATE INDEX waitlist_players_by_waitlist
  ON waitlist_players (waitlist_id, status);

CREATE INDEX games_by_waitlist
  ON games (waitlist_id, status);

CREATE INDEX team_players_by_team
  ON team_players (team_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER waitlists_updated_at BEFORE UPDATE ON waitlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER waitlist_players_updated_at BEFORE UPDATE ON waitlist_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
