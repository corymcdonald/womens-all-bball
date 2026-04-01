-- Add waitlist_id and status to teams for direct querying
ALTER TABLE teams
  ADD COLUMN waitlist_id uuid REFERENCES waitlists(id),
  ADD COLUMN status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'playing', 'completed'));

-- Index for the common query: find staged teams for a waitlist
CREATE INDEX teams_by_waitlist_status ON teams (waitlist_id, status);
