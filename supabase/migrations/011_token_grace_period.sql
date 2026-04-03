-- Configurable grace period for token expiry, per waitlist.
-- Defaults to 5 minutes. Allows staff to extend for events where
-- registration takes longer (e.g. new players filling in details).
ALTER TABLE waitlists
  ADD COLUMN token_grace_period_minutes int NOT NULL DEFAULT 5;
