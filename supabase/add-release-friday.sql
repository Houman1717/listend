-- Release Friday: a weekly push listing the week's new releases
-- (listend-server/releaseFriday.js). Safe to run more than once.

-- Its own off switch in Notification Settings. "Listening reminders" off
-- also stops it, so nobody who opted out of reminders starts getting these.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS release_pushes boolean NOT NULL DEFAULT true;

-- One row per Friday sent: which albums were on the list, so next week only
-- the albums added since count as "new". The primary key also stops a second
-- send on the same day (a restart or a double cron).
CREATE TABLE IF NOT EXISTS release_fridays (
  sent_on     date PRIMARY KEY,
  album_ids   text[] NOT NULL,
  new_count   int NOT NULL DEFAULT 0,
  recipients  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE release_fridays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON release_fridays FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON release_fridays TO service_role;

-- Everyone with a push token and both switches on, plus which of this week's
-- artists they like (rated one 8+ or logged two of theirs), so the push can
-- name those first. p_artists must be lower-cased.
CREATE OR REPLACE FUNCTION public.release_friday_targets(p_artists text[], p_only_user uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid, liked text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id,
         COALESCE((
           SELECT array_agg(x.a)
           FROM (
             SELECT lower(ua.artist) AS a
             FROM user_albums ua
             WHERE ua.user_id = p.id AND lower(ua.artist) = ANY(p_artists)
             GROUP BY lower(ua.artist)
             HAVING max(ua.rating) >= 8 OR count(*) >= 2
           ) x
         ), '{}')
  FROM profiles p
  WHERE COALESCE(p.reminder_pushes, true)
    AND COALESCE(p.release_pushes, true)
    AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = p.id)
    AND (p_only_user IS NULL OR p.id = p_only_user);
$$;

REVOKE ALL ON FUNCTION public.release_friday_targets(text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_friday_targets(text[], uuid) TO service_role;
