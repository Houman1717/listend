-- ─── Fix: likes.target_id must be TEXT, not UUID ─────────────────────────────
--
-- The app stores non-UUID strings in target_id:
--   reviews  → '{reviewer_user_id}_{spotify_id}'   e.g. "abc123_4uLPdfOndFQ3..."
--   playlists → '{playlist_id}'                     e.g. "pl_1744123456789"
--
-- Run this once in the Supabase SQL editor if the column was created as UUID.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE likes
  ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;
