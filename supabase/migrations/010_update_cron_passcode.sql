-- Update the weekly waitlist cron to use basketball-themed passcodes
-- instead of random alphanumeric strings.
-- This keeps the postgres cron in sync with src/constants/passcodes.ts.
-- fmt: off
SELECT
  cron.unschedule('create-weekly-waitlist');

SELECT
  cron.schedule(
    'create-weekly-waitlist',
    '0 0 * * 1',
    $$
    INSERT INTO
      waitlists (passcode)
    SELECT
      word
    FROM
      (
        VALUES
          ('BALL'),
          ('FOUL'),
          ('CUT'),
          ('DUNK'),
          ('PASS'),
          ('WING'),
          ('BLOCK'),
          ('CARRY'),
          ('DRIVE'),
          ('ELBOW'),
          ('LAYUP'),
          ('SHOOT'),
          ('STEAL'),
          ('TIP'),
          ('CHARGE'),
          ('POSTUP'),
          ('CENTER'),
          ('FORWARD'),
          ('DRIBBLE'),
          ('BIG'),
          ('FLOATER'),
          ('HEDGING'),
          ('HIGHLOW'),
          ('LOWPOST'),
          ('REBOUND'),
          ('BANK'),
          ('CLOSEOUT'),
          ('FADEAWAY'),
          ('HIGHPOST'),
          ('HOOK'),
          ('JUMP'),
          ('LIVEBALL'),
          ('MIDRANGE'),
          ('SIXTHMAN'),
          ('STEPBACK'),
          ('TRAPPING')
      ) AS words(word)
    ORDER BY
      random()
    LIMIT
      1;
    $$
  );
