-- Simple DB-based locking mechanism
CREATE TABLE locks (
  key text PRIMARY KEY,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX locks_expires ON locks (expires_at);
