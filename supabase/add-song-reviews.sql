-- ─── Song reviews ────────────────────────────────────────────────────────────
--
-- One row per user per song (Apple Music track id). Logging a song is the same
-- thing as rating/reviewing it — rating 0 means "listened, no rating yet",
-- mirroring user_albums.
--
-- Songs are deliberately kept out of user_albums: everything album-shaped
-- (My Listend, stats, friends' feeds) keeps reading user_albums and is
-- untouched. Friends' activity feeds never read this table.
--
-- is_favorite marks the user's favourite track on an album — at most one per
-- album, enforced by a partial unique index and set through
-- set_favorite_song() so the swap is atomic.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS song_reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id      text        NOT NULL,
  title        text        NOT NULL,
  artist       text        NOT NULL,
  album_id     text,
  album_title  text,
  artwork_url  text,
  duration_ms  integer,
  rating       smallint    NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 10),
  review       text        CHECK (review IS NULL OR char_length(review) <= 5000),
  is_favorite  boolean     NOT NULL DEFAULT false,
  listened_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS song_reviews_user_listened_idx ON song_reviews (user_id, listened_at DESC);
CREATE INDEX IF NOT EXISTS song_reviews_song_idx          ON song_reviews (song_id);
CREATE INDEX IF NOT EXISTS song_reviews_album_idx         ON song_reviews (album_id);

CREATE UNIQUE INDEX IF NOT EXISTS song_reviews_one_favorite_per_album
  ON song_reviews (user_id, album_id)
  WHERE is_favorite AND album_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE song_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_reviews_select" ON song_reviews;
CREATE POLICY "song_reviews_select" ON song_reviews
  FOR SELECT USING (true);

-- Same private-account rule as the album tables (see add-private-accounts.sql).
DROP POLICY IF EXISTS "private_account_select" ON song_reviews;
CREATE POLICY "private_account_select" ON song_reviews
  AS RESTRICTIVE FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.can_view_user(user_id));

DROP POLICY IF EXISTS "song_reviews_insert" ON song_reviews;
CREATE POLICY "song_reviews_insert" ON song_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_reviews_update" ON song_reviews;
CREATE POLICY "song_reviews_update" ON song_reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_reviews_delete" ON song_reviews;
CREATE POLICY "song_reviews_delete" ON song_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- ── RPC: set_favorite_song ──────────────────────────────────────────────────
-- Makes p_song_id the caller's favourite on p_album_id (clearing any other), or
-- clears it when p_on is false. The song row must already exist.
CREATE OR REPLACE FUNCTION public.set_favorite_song(p_album_id text, p_song_id text, p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_album_id IS NULL OR p_song_id IS NULL THEN RAISE EXCEPTION 'invalid song'; END IF;

  UPDATE song_reviews SET is_favorite = false, updated_at = now()
  WHERE user_id = me AND album_id = p_album_id AND is_favorite AND song_id <> p_song_id;

  UPDATE song_reviews SET is_favorite = p_on, updated_at = now()
  WHERE user_id = me AND song_id = p_song_id;
END;
$$;

-- ── Anonymous aggregate ─────────────────────────────────────────────────────
-- Rating sum/count per song from everyone except the caller (the app adds its
-- own so a fresh rating shows instantly). Returns numbers, never identities,
-- so private accounts still count — same as album_community_ratings.
CREATE OR REPLACE FUNCTION public.song_community_ratings(p_song_ids text[])
RETURNS TABLE (song_id text, rating_sum bigint, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sr.song_id, sum(sr.rating)::bigint, count(*)::bigint
  FROM song_reviews sr
  WHERE sr.song_id = ANY (p_song_ids[1:300])
    AND sr.rating > 0
    AND sr.user_id IS DISTINCT FROM auth.uid()
  GROUP BY sr.song_id;
$$;

REVOKE ALL ON FUNCTION public.set_favorite_song(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_favorite_song(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_community_ratings(text[])          TO authenticated, anon;

COMMIT;
