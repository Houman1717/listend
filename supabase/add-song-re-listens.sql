-- ─── Song re-listens ─────────────────────────────────────────────────────────
--
-- The song version of re_listens. song_reviews keeps the first listen frozen
-- (rating, review, listened_at); every later listen is a row here with its own
-- rating, review and date. A song's *current* rating is its most recent
-- non-zero re-listen rating, falling back to the song_reviews rating — the same
-- rule albums use (lib/effectiveRating.ts).
--
-- Rows link to the song by song_key (title minus feat. credits + artist), not
-- song_id, so they survive a song_reviews row moving from the single to the
-- album version. The app copies title/artist from the song_reviews row, so the
-- generated keys always match.
--
-- Safe to re-run. Run after add-song-reviews.sql and add-song-keys.sql.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS song_re_listens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id      text        NOT NULL,
  title        text        NOT NULL,
  artist       text        NOT NULL,
  song_key     text        GENERATED ALWAYS AS (public.song_key(title, artist)) STORED,
  album_id     text,
  album_title  text,
  artwork_url  text,
  rating       smallint    NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 10),
  review       text        CHECK (review IS NULL OR char_length(review) <= 5000),
  listened_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS song_re_listens_user_listened_idx ON song_re_listens (user_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS song_re_listens_user_key_idx      ON song_re_listens (user_id, song_key);
CREATE INDEX IF NOT EXISTS song_re_listens_key_idx           ON song_re_listens (song_key);

-- From 2026-10-30 new tables get no Data API grants by default.
GRANT SELECT ON public.song_re_listens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_re_listens TO authenticated, service_role;

-- ── RLS — same rules as song_reviews ────────────────────────────────────────
ALTER TABLE song_re_listens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_re_listens_select" ON song_re_listens;
CREATE POLICY "song_re_listens_select" ON song_re_listens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "private_account_select" ON song_re_listens;
CREATE POLICY "private_account_select" ON song_re_listens
  AS RESTRICTIVE FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.can_view_user(user_id));

DROP POLICY IF EXISTS "song_re_listens_insert" ON song_re_listens;
CREATE POLICY "song_re_listens_insert" ON song_re_listens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_re_listens_update" ON song_re_listens;
CREATE POLICY "song_re_listens_update" ON song_re_listens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_re_listens_delete" ON song_re_listens;
CREATE POLICY "song_re_listens_delete" ON song_re_listens
  FOR DELETE USING (auth.uid() = user_id);

-- ── Community averages use each person's current rating ─────────────────────
-- Same shape as before (add-song-keys.sql); the only change is that a newer
-- non-zero re-listen rating replaces the first-listen one.
CREATE OR REPLACE FUNCTION public.song_community_ratings_by_key(p_keys text[])
RETURNS TABLE (song_key text, rating_sum bigint, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latest.song_key, sum(latest.rating)::bigint, count(*)::bigint
  FROM (
    SELECT DISTINCT ON (sr.user_id, sr.song_key)
      sr.song_key,
      COALESCE(
        (SELECT rl.rating FROM song_re_listens rl
          WHERE rl.user_id = sr.user_id AND rl.song_key = sr.song_key AND rl.rating > 0
          ORDER BY rl.listened_at DESC LIMIT 1),
        sr.rating
      ) AS rating
    FROM song_reviews sr
    WHERE sr.song_key = ANY (p_keys[1:300])
      AND sr.user_id IS DISTINCT FROM auth.uid()
    ORDER BY sr.user_id, sr.song_key, sr.listened_at DESC
  ) latest
  WHERE latest.rating > 0
  GROUP BY latest.song_key;
$$;

GRANT EXECUTE ON FUNCTION public.song_community_ratings_by_key(text[]) TO authenticated, anon;

COMMIT;
