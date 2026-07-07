-- The notifications.type CHECK constraint was never updated when comment/reply
-- notifications shipped, so inserting type='comment' or 'comment_reply' has been
-- silently failing (see notifyForComment in lib/reviewComments.ts) since that
-- feature launched. Run this once in the Supabase SQL editor.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'message', 'like_review', 'like_playlist', 'comment', 'comment_reply'));
