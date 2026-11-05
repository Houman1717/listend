-- Come-back EMAILS for quiet accounts that can't get pushes (no push token).
-- Builds on add-growth-follows-reengagement.sql. Safe to run more than once.

-- ── Email preferences + unsubscribe tokens ───────────────────────────────────
-- Private (service role only): the token is what an unsubscribe link carries,
-- so it must never be readable by other users the way profiles are.

CREATE TABLE IF NOT EXISTS email_prefs (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unsub_token      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  reminder_emails  boolean NOT NULL DEFAULT true,
  unsubscribed_at  timestamptz
);
ALTER TABLE email_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_prefs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON email_prefs TO service_role;

-- One log for both channels, so the weekly cap covers pushes and emails together.
ALTER TABLE reengagement_pushes ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'push';


-- ── reengagement_candidates, now per channel ─────────────────────────────────
-- p_channel 'push'  : has a push token (unchanged behaviour).
-- p_channel 'email' : no push token, confirmed email, not unsubscribed. Their
--                     first email is an introduction: how Listend works if
--                     they never logged anything, what's new if they did.
-- p_only_user + p_ignore_caps (admin tests) also skip the token rule, so an
-- account that has the app can still be sent a test email.

DROP FUNCTION IF EXISTS public.reengagement_candidates(int, uuid, boolean);

CREATE OR REPLACE FUNCTION public.reengagement_candidates(
  p_limit int DEFAULT 1500,
  p_only_user uuid DEFAULT NULL,
  p_ignore_caps boolean DEFAULT false,
  p_channel text DEFAULT 'push'
)
RETURNS TABLE (user_id uuid, kind text, title text, body text, data jsonb, email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT u.id, u.created_at, u.email,
           COALESCE(NULLIF(btrim(p.display_name), ''), p.username) AS name,
           (SELECT max(ua.created_at) FROM user_albums ua WHERE ua.user_id = u.id) AS last_log
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    LEFT JOIN email_prefs ep ON ep.user_id = u.id
    WHERE COALESCE(p.reminder_pushes, true)
      AND (p_only_user IS NULL OR u.id = p_only_user)
      AND CASE WHEN p_channel = 'email' THEN
                u.email IS NOT NULL
            AND u.email_confirmed_at IS NOT NULL
            AND COALESCE(ep.reminder_emails, true)
            AND (NOT EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = u.id)
                 OR (p_only_user IS NOT NULL AND p_ignore_caps))
          ELSE
            EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = u.id)
          END
  ),
  hist AS (
    SELECT b.*,
           (SELECT max(r.sent_at) FROM reengagement_pushes r WHERE r.user_id = b.id) AS last_push,
           (SELECT r.kind FROM reengagement_pushes r WHERE r.user_id = b.id ORDER BY r.sent_at DESC LIMIT 1) AS last_kind,
           (SELECT count(*) FROM reengagement_pushes r
             WHERE r.user_id = b.id AND r.sent_at > COALESCE(b.last_log, b.created_at)) AS sent_since_active,
           (SELECT count(*) FROM reengagement_pushes r
             WHERE r.user_id = b.id AND r.channel = 'email') AS emails_ever
    FROM base b
  ),
  eligible AS (
    SELECT h.* FROM hist h
    WHERE p_ignore_caps OR (
          h.created_at < now() - interval '1 day'
      AND (h.last_log IS NULL OR h.last_log < now() - interval '7 days')
      AND (h.last_push IS NULL OR h.last_push < now() - interval '7 days')
      AND h.sent_since_active < 4
    )
  ),
  release AS (
    SELECT DISTINCT ON (e.id) e.id, nr.spotify_id, nr.title, nr.artist, nr.artwork_url, nr.year
    FROM eligible e
    JOIN LATERAL (
      SELECT lower(ua.artist) AS artist_l
      FROM user_albums ua WHERE ua.user_id = e.id
      GROUP BY lower(ua.artist)
      HAVING max(ua.rating) >= 8 OR count(*) >= 2
    ) fav ON true
    -- top of the curated list only: it runs newest first and keeps ~80 rows
    JOIN new_release_albums nr ON lower(nr.artist) = fav.artist_l AND nr.position < 30
    WHERE NOT EXISTS (
      SELECT 1 FROM user_albums x
      WHERE x.user_id = e.id AND (x.spotify_id = nr.spotify_id OR lower(x.title) = lower(nr.title))
    )
    ORDER BY e.id, nr.position
  ),
  friends AS (
    SELECT e.id,
           count(DISTINCT ua.user_id) AS n,
           (array_agg(COALESCE(NULLIF(p.display_name, ''), p.username, 'A friend') ORDER BY ua.created_at DESC))[1] AS top_name
    FROM eligible e
    JOIN follows f ON f.follower_id = e.id
    -- mutual only: Recent Activity (where it lands) shows mutual friends
    JOIN follows back ON back.follower_id = f.following_id AND back.following_id = e.id
    JOIN user_albums ua ON ua.user_id = f.following_id AND ua.created_at > now() - interval '7 days'
    JOIN profiles p ON p.id = ua.user_id
    GROUP BY e.id
  ),
  options AS (
    SELECT e.id, e.last_kind, e.last_log, e.created_at, o.*
    FROM eligible e
    LEFT JOIN release r  ON r.id = e.id
    LEFT JOIN friends fr ON fr.id = e.id
    CROSS JOIN LATERAL (VALUES
      -- email only: the first email introduces Listend
      (0, 'welcome_how', p_channel = 'email' AND e.emails_ever = 0 AND e.last_log IS NULL,
          'Here''s how Listend works',
          'Log albums, rate them out of 10, and see what your friends are playing.',
          jsonb_build_object('route', 'search')),
      (0, 'whats_new', p_channel = 'email' AND e.emails_ever = 0 AND e.last_log IS NOT NULL,
          'What''s new on Listend',
          'Song ratings, Month and Year in Review, People to Follow and more.',
          jsonb_build_object('route', 'home')),
      (1, 'new_release', r.id IS NOT NULL,
          'New from ' || r.artist,
          r.title || ' is out. Give it a listen, then log it on Listend.',
          jsonb_build_object('route', 'album', 'albumId', r.spotify_id, 'title', r.title,
                             'artist', r.artist, 'artworkUrl', r.artwork_url, 'year', r.year)),
      (2, 'friends_active', fr.id IS NOT NULL,
          'Your friends have been listening',
          CASE WHEN fr.n > 1
               THEN fr.top_name || ' and ' || (fr.n - 1) || CASE WHEN fr.n = 2 THEN ' other' ELSE ' others' END
                    || ' logged albums this week. See what they picked.'
               ELSE fr.top_name || ' logged an album this week. See what they picked.' END,
          jsonb_build_object('route', 'recent-activity', 'friend', fr.top_name, 'count', fr.n)),
      (3, 'first_log', e.last_log IS NULL,
          'What are you listening to?',
          'Log your first album on Listend. Rate it out of 10 and it''s on your profile.',
          jsonb_build_object('route', 'search')),
      (4, 'flip', true,
          'Need something new to listen to?',
          'Flip a Record picks a classic album for you. Give it a spin.',
          jsonb_build_object('route', 'flip'))
    ) AS o(prio, kind, ok, title, body, data)
    WHERE o.ok
  ),
  picked AS (
    SELECT DISTINCT ON (o.id) o.id, o.kind, o.title, o.body, o.data,
           COALESCE(o.last_log, o.created_at) AS active_at
    FROM options o
    ORDER BY o.id, (o.kind = o.last_kind), o.prio   -- rotate: repeat last kind only if nothing else fits
  )
  SELECT pk.id, pk.kind, pk.title, pk.body,
         pk.data || jsonb_build_object('type', 'reengage', 'kind', pk.kind),
         e.email, e.name
  FROM picked pk
  JOIN eligible e ON e.id = pk.id
  ORDER BY pk.active_at DESC          -- most recently active first: likeliest to come back
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1500), 1), 5000);
$$;

REVOKE ALL ON FUNCTION public.reengagement_candidates(int, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reengagement_candidates(int, uuid, boolean, text) TO service_role;
