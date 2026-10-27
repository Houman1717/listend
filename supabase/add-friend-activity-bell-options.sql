-- ─── Friend activity: per-type options on the bell ──────────────────────────
--
-- Tapping the bell on a friend's profile opens a menu (like Instagram's) with
-- three toggles stored on the bell row:
--   reviews  — push when they review an album
--   ratings  — push when they rate an album
--   listens  — push for every album they log, rated or not
-- A row with all three off is deleted by the app, so "row exists" still means
-- "bell on".
--
-- Run after add-friend-activity-notifications.sql (+ fix-friend-activity-bell-only.sql
-- if you ran the first version of it). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE friend_activity_subscriptions
  ADD COLUMN IF NOT EXISTS reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ratings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS listens boolean NOT NULL DEFAULT false;

-- Toggling an option is an upsert, which needs UPDATE.
GRANT UPDATE ON public.friend_activity_subscriptions TO authenticated;

DROP POLICY IF EXISTS "friend_activity_subscriptions_update" ON friend_activity_subscriptions;
CREATE POLICY "friend_activity_subscriptions_update" ON friend_activity_subscriptions
  FOR UPDATE
  USING (auth.uid() = subscriber_id)
  WITH CHECK (
    auth.uid() = subscriber_id
    AND EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = target_id
    )
  );

-- Who wants this particular album: anyone on "every listen", plus ratings
-- fans when it's rated and review fans when it's reviewed. Still requires an
-- accepted follow and no block either way.
DROP FUNCTION IF EXISTS public.friend_activity_recipients(uuid);
CREATE OR REPLACE FUNCTION public.friend_activity_recipients(
  p_actor    uuid,
  p_rated    boolean,
  p_reviewed boolean
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.subscriber_id
  FROM friend_activity_subscriptions s
  WHERE s.target_id = p_actor
    AND (s.listens OR (s.ratings AND p_rated) OR (s.reviews AND p_reviewed))
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

REVOKE ALL ON FUNCTION public.friend_activity_recipients(uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friend_activity_recipients(uuid, boolean, boolean) TO service_role;

COMMIT;
