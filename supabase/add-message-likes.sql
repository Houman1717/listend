-- ─── DM likes (double-tap a message) ─────────────────────────────────────────
--
-- Likes live on the message row, so they come back with the conversation's
-- normal messages select (and its 5s poll) and are only visible to the two
-- people who can already read the message.
--
-- Writes go through toggle_message_like() rather than an UPDATE policy on
-- messages, so a participant can change liked_by (only their own entry) and
-- nothing else on the row.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS liked_by UUID[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION toggle_message_like(p_message_id TEXT, p_like BOOLEAN)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid    UUID := auth.uid();
  result UUID[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  UPDATE messages
     SET liked_by = CASE
           WHEN p_like AND NOT (uid = ANY(liked_by)) THEN array_append(liked_by, uid)
           WHEN NOT p_like                          THEN array_remove(liked_by, uid)
           ELSE liked_by
         END
   WHERE id::TEXT = p_message_id
     AND uid IN (sender_id, receiver_id)
  RETURNING liked_by INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION toggle_message_like(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION toggle_message_like(TEXT, BOOLEAN) TO authenticated;
