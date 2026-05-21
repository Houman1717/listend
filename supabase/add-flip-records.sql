-- Table that records every "Flip a Record" event (created when the user flips)
CREATE TABLE IF NOT EXISTS flip_records (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_title  text NOT NULL,
  album_artist text NOT NULL,
  album_year   integer,
  flipped_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-user lookups (recent activity, streak)
CREATE INDEX IF NOT EXISTS flip_records_user_id_idx ON flip_records (user_id, flipped_at DESC);

-- RLS
ALTER TABLE flip_records ENABLE ROW LEVEL SECURITY;

-- Users can insert their own rows
CREATE POLICY "insert_own_flips" ON flip_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own flips; followers can read theirs (for friend feeds)
CREATE POLICY "read_flips" ON flip_records
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid()
        AND following_id = flip_records.user_id
    )
  );
