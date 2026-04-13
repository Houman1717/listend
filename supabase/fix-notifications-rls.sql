-- ─── Fix: notifications INSERT policy ────────────────────────────────────────
--
-- The original policy was likely:
--   WITH CHECK (auth.uid() = user_id)
--
-- This blocks like/follow notifications where user_id = the recipient (another
-- user), not the currently authenticated inserter.
--
-- The correct rule: any authenticated user can insert a notification, but only
-- for a valid actor_id (themselves). They must not be able to spoof actor_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old restrictive insert policy (adjust the name if yours differs)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON notifications;

-- New policy: authenticated users can insert a notification row as long as
-- actor_id matches their own uid (prevents spoofing the sender).
-- user_id (recipient) can be any user — that's intentional for fan-out.
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
