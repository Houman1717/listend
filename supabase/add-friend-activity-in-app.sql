-- ─── Friend activity in the in-app Notifications list ───────────────────────
--
-- Friend-activity pushes were push-only. This lets the server also write a
-- notifications row per recipient so they show on the Notifications screen:
--
-- 1. Allow notifications.type = 'friend_activity' (appended to whatever list
--    is live, same as add-message-like-notifications.sql).
-- 2. notifications.detail — the line after the actor's name, e.g.
--    "reviewed Blonde · 9/10". Written by the server (service role) only.
--
-- The notifications INSERT webhook skips 'friend_activity' — the server sends
-- that push itself with the album in it.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
    FROM pg_constraint
   WHERE conname = 'notifications_type_check'
     AND conrelid = 'public.notifications'::regclass;

  IF def IS NOT NULL AND position('friend_activity' IN def) = 0 THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE 'ALTER TABLE notifications ADD CONSTRAINT notifications_type_check '
         || replace(def, 'ARRAY[', 'ARRAY[''friend_activity''::text, ');
  END IF;
END $$;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS detail text;
