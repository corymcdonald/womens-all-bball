-- Short-lived tokens for QR-code-based waitlist joining
CREATE TABLE waitlist_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES waitlists(id),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX waitlist_tokens_lookup
  ON waitlist_tokens (token, expires_at);

CREATE INDEX waitlist_tokens_by_waitlist
  ON waitlist_tokens (waitlist_id, expires_at);
