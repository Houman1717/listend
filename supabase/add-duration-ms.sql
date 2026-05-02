-- Add duration_ms column to user_albums so the Duration sort filter works.
-- This stores the total album runtime in milliseconds, populated the first time
-- a user opens an album's detail screen after logging it.

ALTER TABLE user_albums
  ADD COLUMN IF NOT EXISTS duration_ms bigint DEFAULT NULL;
