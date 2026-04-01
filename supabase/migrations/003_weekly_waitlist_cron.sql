-- Enable pg_cron extension (available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a new waitlist every Monday at 00:00 UTC with a random 4-char passcode
SELECT cron.schedule(
  'create-weekly-waitlist',
  '0 0 * * 1',
  $$
    INSERT INTO waitlists (passcode)
    VALUES (
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int) ||
      chr(48 + floor(random() * 10)::int) ||
      chr(65 + floor(random() * 26)::int)
    );
  $$
);
