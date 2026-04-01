-- Link users to Clerk authentication
ALTER TABLE users ADD COLUMN clerk_id text UNIQUE;
CREATE INDEX users_clerk_id ON users (clerk_id) WHERE clerk_id IS NOT NULL;

-- Replace phone with email
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users ADD COLUMN email text UNIQUE;
