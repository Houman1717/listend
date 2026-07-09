-- Comment/reply likes now insert notifications.type='like_comment' (see
-- handleLike in components/ReviewComments.tsx), but the CHECK constraint was
-- never updated to allow it, so those inserts fail silently — same bug class
-- as fix-notifications-comment-type.sql. Run this once in the Supabase SQL editor.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'message', 'like_review', 'like_playlist', 'like_comment', 'comment', 'comment_reply'));
