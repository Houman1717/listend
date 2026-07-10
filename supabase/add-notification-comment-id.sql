-- Notifications only carried target_id (the review), not which specific
-- comment/reply was liked, so tapping a like_comment/like_reply notification
-- could only open the comments section in general, never the actual comment.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id uuid;
