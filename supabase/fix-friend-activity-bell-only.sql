-- ─── Friend activity: the bell is the only switch ───────────────────────────
--
-- add-friend-activity-notifications.sql first shipped with a master switch
-- (profiles.notify_friend_activity) on top of the per-friend bell. Two steps
-- for one thing — the bell alone now decides. Run this once if you already ran
-- the original; fresh setups get the same result from the updated original.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Bell rung + still an accepted follower + no block either way.
CREATE OR REPLACE FUNCTION public.friend_activity_recipients(p_actor uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.subscriber_id
  FROM friend_activity_subscriptions s
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

REVOKE ALL ON FUNCTION public.friend_activity_recipients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friend_activity_recipients(uuid) TO service_role;

ALTER TABLE profiles DROP COLUMN IF EXISTS notify_friend_activity;

COMMIT;
