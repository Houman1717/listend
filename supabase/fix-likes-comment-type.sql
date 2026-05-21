-- Allow comment likes in the likes table
-- The original CHECK constraint only allowed 'review' and 'playlist'.
-- Drop and recreate to include 'comment'.
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_target_type_check;
ALTER TABLE likes ADD CONSTRAINT likes_target_type_check
  CHECK (target_type IN ('review', 'playlist', 'comment'));
