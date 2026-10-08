-- ─── "X liked your message" notifications ─────────────────────────────────────
--
-- Run once in the Supabase SQL editor, after add-message-likes.sql.
--
-- 1. Allow notifications.type = 'like_message'. The constraint has been
--    rewritten several times (follow requests etc.), so this appends to
--    whatever list is live instead of restating it.
-- 2. toggle_message_like() now creates the notification itself when you like
--    someone else's message (target_id = message id), and removes it again
--    if you unlike before they've seen it. Doing it here means it can't be
--    skipped or spoofed from the client, and re-liking doesn't stack copies.
--    The existing notifications INSERT webhook sends the push.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
    FROM pg_constraint
   WHERE conname = 'notifications_type_check'
     AND conrelid = 'public.notifications'::regclass;

  IF def IS NOT NULL AND position('like_message' IN def) = 0 THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE 'ALTER TABLE notifications ADD CONSTRAINT notifications_type_check '
         || replace(def, 'ARRAY[', 'ARRAY[''like_message''::text, ');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION toggle_message_like(p_message_id TEXT, p_like BOOLEAN)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       UUID := auth.uid();
  result    UUID[];
  author_id UUID;
  was_liked BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  SELECT sender_id, uid = ANY(liked_by) INTO author_id, was_liked
    FROM messages
   WHERE id::TEXT = p_message_id
     AND uid IN (sender_id, receiver_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE messages
     SET liked_by = CASE
           WHEN p_like AND NOT was_liked THEN array_append(liked_by, uid)
           WHEN NOT p_like               THEN array_remove(liked_by, uid)
           ELSE liked_by
         END
   WHERE id::TEXT = p_message_id
  RETURNING liked_by INTO result;

  IF author_id <> uid THEN
    IF p_like AND NOT was_liked THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
         WHERE user_id = author_id AND actor_id = uid
           AND type = 'like_message' AND target_id = p_message_id
      ) THEN
        INSERT INTO notifications (user_id, type, actor_id, target_id)
        VALUES (author_id, 'like_message', uid, p_message_id);
      END IF;
    ELSIF NOT p_like AND was_liked THEN
      DELETE FROM notifications
       WHERE user_id = author_id AND actor_id = uid
         AND type = 'like_message' AND target_id = p_message_id
         AND read = false;
    END IF;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION toggle_message_like(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION toggle_message_like(TEXT, BOOLEAN) TO authenticated;
