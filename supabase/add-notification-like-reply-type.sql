-- Adds a distinct 'like_reply' notification type (liking a reply reads as
-- "liked your reply" instead of the generic "liked your comment"), and
-- re-applies the full allowed-type list in case the earlier
-- fix-notifications-like-comment-type.sql migration was never actually run
-- against production — that would explain 'like_comment' inserts silently
-- failing and no notification row ever being created for reply likes.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'message', 'like_review', 'like_playlist', 'like_comment', 'like_reply', 'comment', 'comment_reply'));
