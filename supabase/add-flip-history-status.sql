-- Promotes flip_records from a write-only feed log into the full source of
-- truth for "Flip a Record" history, so it survives logout/new-phone instead
-- of living only in device-local AsyncStorage.

ALTER TABLE flip_records ADD COLUMN IF NOT EXISTS pool_id text;
ALTER TABLE flip_records ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE flip_records ADD COLUMN IF NOT EXISTS artwork_url text;
ALTER TABLE flip_records ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

ALTER TABLE flip_records DROP CONSTRAINT IF EXISTS flip_records_status_check;
ALTER TABLE flip_records ADD CONSTRAINT flip_records_status_check
  CHECK (status IN ('pending', 'logged', 'didnt_listen'));

-- The artwork-backfill upsert (`onConflict: 'user_id,flipped_at'`) has had no
-- matching unique constraint to conflict against, so it's been silently
-- failing on every call.
CREATE UNIQUE INDEX IF NOT EXISTS flip_records_user_flipped_at_key
  ON flip_records (user_id, flipped_at);

-- Was missing entirely — needed so markLogged/markDidntListen can write.
DROP POLICY IF EXISTS "update_own_flips" ON flip_records;
CREATE POLICY "update_own_flips" ON flip_records
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
