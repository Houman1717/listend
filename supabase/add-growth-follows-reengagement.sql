-- Growth: people-to-follow suggestions, "who invited you?" and re-engagement
-- pushes for quiet accounts. Additive only — safe to run more than once.

-- ── Columns ──────────────────────────────────────────────────────────────────

-- Who a new account said invited them. Written only by claim_inviter().
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
-- Off switch for "come back" pushes (Notification Settings → Reminders).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_pushes boolean NOT NULL DEFAULT true;

-- suggested_follows() matches people by albums in common.
CREATE INDEX IF NOT EXISTS user_albums_spotify_id_idx ON user_albums (spotify_id);
CREATE INDEX IF NOT EXISTS user_albums_user_created_idx ON user_albums (user_id, created_at DESC);


-- ── suggested_follows ────────────────────────────────────────────────────────
-- Public, recently active accounts the caller doesn't already follow, ranked
-- by albums in common first and popularity second, so a brand-new account
-- with nothing logged still gets the most-followed active reviewers.

CREATE OR REPLACE FUNCTION public.suggested_follows(p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text, is_pro boolean,
  shared_count int, followers int, reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  RETURN QUERY
  WITH mine AS (
    SELECT ua.spotify_id FROM user_albums ua WHERE ua.user_id = me
  ),
  my AS (SELECT count(*)::int AS n FROM mine),
  shared AS (
    SELECT ua.user_id, count(*)::int AS n
    FROM user_albums ua JOIN mine m ON m.spotify_id = ua.spotify_id
    WHERE ua.user_id <> me
    GROUP BY ua.user_id
  ),
  fol AS (
    SELECT f.following_id AS user_id, count(*)::int AS n FROM follows f GROUP BY f.following_id
  ),
  active AS (
    SELECT ua.user_id, count(*)::int AS logs, max(ua.created_at) AS last_log
    FROM user_albums ua
    GROUP BY ua.user_id
    HAVING max(ua.created_at) > now() - interval '30 days' AND count(*) >= 5
  ),
  scored AS (
    SELECT p.id, p.username, p.display_name, p.avatar_url, COALESCE(p.is_pro, false) AS is_pro,
           COALESCE(s.n, 0) AS shared_count, COALESCE(f.n, 0) AS followers, a.last_log,
           -- overlap relative to both library sizes, so 1,000-album accounts
           -- don't win just by having logged everything
           ( 40.0 * COALESCE(s.n, 0) / sqrt(GREATEST(my.n, 1)::numeric * a.logs)
           + ln(1 + COALESCE(f.n, 0)) * 1.5
           + CASE WHEN p.avatar_url IS NOT NULL AND p.avatar_url <> '' THEN 1 ELSE 0 END
           + CASE WHEN a.last_log > now() - interval '7 days' THEN 1 ELSE 0 END
           + random() * 0.5                -- small shuffle so refreshes vary
           ) AS score,
           -- Pro perk: established, active Pro accounts get extra exposure (see
           -- the final ORDER BY), spread through the list rather than stacked on top.
           (COALESCE(p.is_pro, false) AND COALESCE(f.n, 0) >= 10
             AND a.last_log > now() - interval '7 days') AS boosted
    FROM active a
    JOIN profiles p ON p.id = a.user_id
    LEFT JOIN shared s ON s.user_id = p.id
    LEFT JOIN fol f ON f.user_id = p.id
    CROSS JOIN my
    WHERE p.id <> me
      AND NOT COALESCE(p.is_private, false)
      AND p.username IS NOT NULL
      AND p.username NOT LIKE ('%\_' || right(replace(p.id::text, '-', ''), 12))
      AND NOT EXISTS (SELECT 1 FROM follows x WHERE x.follower_id = me AND x.following_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM follow_requests r WHERE r.requester_id = me AND r.target_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = me AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = me)
      )
  ),
  ranked AS (
    SELECT sc.*,
           -- which boosted Pro gets which slot is random, so sign-ups see different ones
           CASE WHEN sc.boosted THEN row_number() OVER (PARTITION BY sc.boosted ORDER BY random()) END AS boost_rn,
           row_number() OVER (PARTITION BY sc.boosted ORDER BY sc.score DESC) AS group_rn,
           -- non-boosted accounts ranked above this row (its natural spot)
           sum(CASE WHEN sc.boosted THEN 0 ELSE 1 END)
             OVER (ORDER BY sc.score DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS nb_ahead
    FROM scored sc
  )
  SELECT r.id, r.username, r.display_name, r.avatar_url, r.is_pro, r.shared_count, r.followers,
         CASE WHEN r.shared_count >= 3 THEN r.shared_count || ' albums in common'
              WHEN r.followers >= 10   THEN 'Popular on Listend'
              -- only claim "this week" when it's true; the pool goes back 30 days
              WHEN r.last_log > now() - interval '7 days' THEN 'Active this week'
              ELSE 'Active this month' END AS reason
  FROM ranked r
  -- Normal suggestions keep their order (1, 2, 3, ...). Boosted Pro accounts slot
  -- in after positions 1, 5, 9, 13, 17, so roughly one in every five rows, or at
  -- their natural spot if that's higher. Never pushed down, never stacked.
  ORDER BY CASE WHEN r.boosted THEN LEAST(r.nb_ahead + 0.5, r.boost_rn * 4 - 2.5)
                ELSE r.group_rn END
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.suggested_follows(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggested_follows(int) TO authenticated;


-- ── claim_inviter ────────────────────────────────────────────────────────────
-- "Who invited you?" during onboarding. The new account follows the inviter
-- (or requests to, if private) and the inviter's notification says the
-- invite worked, so they can follow back. The notification stays type
-- follow / follow_request with the wording in `detail`, which every app
-- version already renders. One claim per account, within 14 days of signup.

CREATE OR REPLACE FUNCTION public.claim_inviter(p_username text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  handle text := lower(btrim(ltrim(btrim(COALESCE(p_username, '')), '@')));
  target uuid;
  target_private boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF handle = '' THEN RETURN 'not_found'; END IF;

  IF (SELECT created_at FROM auth.users WHERE id = me) < now() - interval '14 days' THEN
    RETURN 'too_late';
  END IF;
  IF (SELECT invited_by FROM profiles WHERE id = me) IS NOT NULL THEN
    RETURN 'already_claimed';
  END IF;

  SELECT p.id, COALESCE(p.is_private, false) INTO target, target_private
  FROM profiles p WHERE lower(p.username) = handle LIMIT 1;

  IF target IS NULL THEN RETURN 'not_found'; END IF;
  IF target = me THEN RETURN 'self'; END IF;
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = me AND blocked_id = target) OR (blocker_id = target AND blocked_id = me)
  ) THEN
    RETURN 'not_found';   -- don't reveal blocks
  END IF;

  UPDATE profiles SET invited_by = target WHERE id = me;

  IF EXISTS (SELECT 1 FROM follows WHERE follower_id = me AND following_id = target) THEN
    RETURN 'following';
  END IF;

  IF target_private THEN
    IF NOT EXISTS (SELECT 1 FROM follow_requests WHERE requester_id = me AND target_id = target) THEN
      INSERT INTO follow_requests (requester_id, target_id) VALUES (me, target);
      INSERT INTO notifications (user_id, type, actor_id, detail)
      VALUES (target, 'follow_request', me, 'joined Listend from your invite and wants to follow you');
    END IF;
    RETURN 'requested';
  END IF;

  INSERT INTO follows (follower_id, following_id) VALUES (me, target);
  INSERT INTO notifications (user_id, type, actor_id, detail)
  VALUES (target, 'follow', me, 'joined Listend from your invite. Follow them back?');
  RETURN 'following';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_inviter(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_inviter(text) TO authenticated;


-- ── Re-engagement pushes ─────────────────────────────────────────────────────
-- One row per "come back" push sent, so the daily job can cap frequency and
-- rotate the message. Server (service role) only.

CREATE TABLE IF NOT EXISTS reengagement_pushes (
  id       bigserial PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind     text NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reengagement_pushes_user_sent_idx ON reengagement_pushes (user_id, sent_at DESC);
ALTER TABLE reengagement_pushes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reengagement_pushes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON reengagement_pushes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE reengagement_pushes_id_seq TO service_role;

-- Who should get a push today, and which one.
--   Eligible: has a push token, reminders on, account ≥ 1 day old, nothing
--   logged in 7 days, no re-engagement push in 7 days, and fewer than 4 sent
--   since they were last active (so someone who never comes back stops
--   hearing from us after a month).
--   Message, best first, not the same kind twice in a row unless it's the only one:
--     new_release    an artist they rated 8+ (or logged twice) is on New Releases
--     friends_active mutual friends logged albums this week
--     first_log      they've never logged anything
--     flip           Flip a Record, the fallback
-- p_only_user + p_ignore_caps let the admin route test on one account.

CREATE OR REPLACE FUNCTION public.reengagement_candidates(
  p_limit int DEFAULT 1500,
  p_only_user uuid DEFAULT NULL,
  p_ignore_caps boolean DEFAULT false
)
RETURNS TABLE (user_id uuid, kind text, title text, body text, data jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT u.id, u.created_at,
           (SELECT max(ua.created_at) FROM user_albums ua WHERE ua.user_id = u.id) AS last_log
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE COALESCE(p.reminder_pushes, true)
      AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = u.id)
      AND (p_only_user IS NULL OR u.id = p_only_user)
  ),
  hist AS (
    SELECT b.*,
           (SELECT max(r.sent_at) FROM reengagement_pushes r WHERE r.user_id = b.id) AS last_push,
           (SELECT r.kind FROM reengagement_pushes r WHERE r.user_id = b.id ORDER BY r.sent_at DESC LIMIT 1) AS last_kind,
           (SELECT count(*) FROM reengagement_pushes r
             WHERE r.user_id = b.id AND r.sent_at > COALESCE(b.last_log, b.created_at)) AS sent_since_active
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
    -- top of the curated list only: it runs newest first and keeps ~80 rows,
    -- and "New from X" for something out months ago would read wrong
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
    -- mutual only: Recent Activity (where the push lands) shows mutual friends
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
          jsonb_build_object('route', 'recent-activity')),
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
    SELECT DISTINCT ON (o.id) o.id, o.kind, o.title, o.body, o.data, COALESCE(o.last_log, o.created_at) AS active_at
    FROM options o
    ORDER BY o.id, (o.kind = o.last_kind), o.prio   -- rotate: repeat last week's kind only if nothing else fits
  )
  SELECT pk.id, pk.kind, pk.title, pk.body,
         pk.data || jsonb_build_object('type', 'reengage', 'kind', pk.kind)
  FROM picked pk
  ORDER BY pk.active_at DESC          -- most recently active first: likeliest to come back
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1500), 1), 5000);
$$;

REVOKE ALL ON FUNCTION public.reengagement_candidates(int, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reengagement_candidates(int, uuid, boolean) TO service_role;
