-- Replace phone with email on users table
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users ADD COLUMN email text UNIQUE;
CREATE INDEX users_email ON users (email) WHERE email IS NOT NULL;
