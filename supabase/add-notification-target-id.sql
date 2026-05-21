-- Add target_id to notifications so like_review notifications can deep-link
-- directly to the relevant album/review instead of the actor's profile.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_id text;
