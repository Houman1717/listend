-- ─── Song identity across versions ───────────────────────────────────────────
--
-- Apple Music gives the single and the album version of a song different ids,
-- so ratings/reviews were split between them. song_key groups versions of the
-- same song: lower-cased title with any "(feat. …)" / "[with …]" credit
-- removed, plus lower-cased artist.
--
-- lib/songReviews.ts songKey() must produce exactly the same string.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.song_key(p_title text, p_artist text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(btrim(regexp_replace(
           regexp_replace(coalesce(p_title, ''), '\s*[\(\[](feat|ft|with)\.?\s[^\)\]]*[\)\]]', '', 'gi'),
           '\s+', ' ', 'g')))
      || '|' ||
         lower(btrim(regexp_replace(coalesce(p_artist, ''), '\s+', ' ', 'g')));
$$;

ALTER TABLE song_reviews
  ADD COLUMN IF NOT EXISTS song_key text GENERATED ALWAYS AS (public.song_key(title, artist)) STORED;

CREATE INDEX IF NOT EXISTS song_reviews_key_idx      ON song_reviews (song_key);
CREATE INDEX IF NOT EXISTS song_reviews_user_key_idx ON song_reviews (user_id, song_key);

-- Rating sum/count per song_key from everyone except the caller, one rating
-- per user (their most recent row, in case they logged two versions).
CREATE OR REPLACE FUNCTION public.song_community_ratings_by_key(p_keys text[])
RETURNS TABLE (song_key text, rating_sum bigint, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latest.song_key, sum(latest.rating)::bigint, count(*)::bigint
  FROM (
    SELECT DISTINCT ON (sr.user_id, sr.song_key) sr.song_key, sr.rating
    FROM song_reviews sr
    WHERE sr.song_key = ANY (p_keys[1:300])
      AND sr.user_id IS DISTINCT FROM auth.uid()
    ORDER BY sr.user_id, sr.song_key, sr.listened_at DESC
  ) latest
  WHERE latest.rating > 0
  GROUP BY latest.song_key;
$$;

GRANT EXECUTE ON FUNCTION public.song_key(text, text)                     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.song_community_ratings_by_key(text[])    TO authenticated, anon;

COMMIT;
