-- ─── Friend activity notifications ──────────────────────────────────────────
--
-- Push a follower when a friend logs, rates or reviews an album. Opt-in on
-- two levels, both off by default:
--
-- 1. profiles.notify_friend_activity — the master switch (Settings → Notifications).
-- 2. friend_activity_subscriptions — the bell on a friend's profile. Only
--    accepted followers can ring it, and unfollowing (or blocking, which
--    deletes the follows rows) removes it.
--
-- The Express server sends the pushes with the service role. It calls
-- friend_activity_recipients() to get who to notify and
-- claim_friend_activity_push() so each friend+album pushes once.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Master switch ───────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_friend_activity boolean NOT NULL DEFAULT false;

-- ── Bells ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_activity_subscriptions (
  subscriber_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber_id, target_id),
  CHECK (subscriber_id <> target_id)
);

CREATE INDEX IF NOT EXISTS friend_activity_subscriptions_target_idx
  ON friend_activity_subscriptions (target_id);

GRANT SELECT, INSERT, DELETE ON public.friend_activity_subscriptions TO authenticated, service_role;

ALTER TABLE friend_activity_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only the subscriber sees their bells — the friend never learns who rang one.
DROP POLICY IF EXISTS "friend_activity_subscriptions_select" ON friend_activity_subscriptions;
CREATE POLICY "friend_activity_subscriptions_select" ON friend_activity_subscriptions
  FOR SELECT USING (auth.uid() = subscriber_id);

DROP POLICY IF EXISTS "friend_activity_subscriptions_insert" ON friend_activity_subscriptions;
CREATE POLICY "friend_activity_subscriptions_insert" ON friend_activity_subscriptions
  FOR INSERT WITH CHECK (
    auth.uid() = subscriber_id
    AND EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = target_id
    )
  );

DROP POLICY IF EXISTS "friend_activity_subscriptions_delete" ON friend_activity_subscriptions;
CREATE POLICY "friend_activity_subscriptions_delete" ON friend_activity_subscriptions
  FOR DELETE USING (auth.uid() = subscriber_id);

-- Unfollow (and block, which deletes follows) silences the bell.
CREATE OR REPLACE FUNCTION public.follows_drop_friend_activity_bell()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM friend_activity_subscriptions
  WHERE subscriber_id = OLD.follower_id AND target_id = OLD.following_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS follows_drop_friend_activity_bell ON follows;
CREATE TRIGGER follows_drop_friend_activity_bell
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION public.follows_drop_friend_activity_bell();

-- ── Dedupe: one push per friend + album ─────────────────────────────────────
-- Server-only bookkeeping; no client policies.
CREATE TABLE IF NOT EXISTS friend_activity_pushes (
  actor_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_id text        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, spotify_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_activity_pushes TO service_role;

ALTER TABLE friend_activity_pushes ENABLE ROW LEVEL SECURITY;

-- True when this push should go out: the first for this friend+album, or the
-- last one was longer ago than p_repeat_after. Atomic, so a double tap or a
-- retried request can't send twice.
CREATE OR REPLACE FUNCTION public.claim_friend_activity_push(
  p_actor        uuid,
  p_spotify_id   text,
  p_repeat_after interval
)
RETURNS boolean
LANGUAGE sql
SET search_path = public
AS $$
  WITH claimed AS (
    INSERT INTO friend_activity_pushes (actor_id, spotify_id, sent_at)
    VALUES (p_actor, p_spotify_id, now())
    ON CONFLICT (actor_id, spotify_id) DO UPDATE
      SET sent_at = now()
      WHERE friend_activity_pushes.sent_at < now() - p_repeat_after
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$;

-- ── Who to notify ───────────────────────────────────────────────────────────
-- Bell rung + master switch on + still an accepted follower + no block either way.
CREATE OR REPLACE FUNCTION public.friend_activity_recipients(p_actor uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.subscriber_id
  FROM friend_activity_subscriptions s
  JOIN profiles p ON p.id = s.subscriber_id AND p.notify_friend_activity
  WHERE s.target_id = p_actor
    AND EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = s.subscriber_id AND f.following_id = p_actor
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users b
      WHERE (b.blocker_id = s.subscriber_id AND b.blocked_id = p_actor)
         OR (b.blocker_id = p_actor AND b.blocked_id = s.subscriber_id)
    );
$$;

REVOKE ALL ON FUNCTION public.claim_friend_activity_push(uuid, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.friend_activity_recipients(uuid)                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_friend_activity_push(uuid, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.friend_activity_recipients(uuid)                 TO service_role;

COMMIT;
