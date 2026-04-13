-- ─── Likes table ──────────────────────────────────────────────────────────────
--
-- target_type = 'review'
--   target_id  = '{reviewer_user_id}_{spotify_id}'   (composite key as string)
--
-- target_type = 'playlist'
--   target_id  = '{playlist_uuid}'
--
-- target_owner_id is the UUID of the user who owns the liked item (used for
-- notification routing and cascade deletes).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS likes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type     TEXT        NOT NULL CHECK (target_type IN ('review', 'playlist')),
  target_id       TEXT        NOT NULL,
  target_owner_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);

-- Row-level security ──────────────────────────────────────────────────────────

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read likes (required for like counts / state checks)
CREATE POLICY "likes_select"
  ON likes FOR SELECT
  USING (true);

-- Users can only insert their own like rows
CREATE POLICY "likes_insert"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own like rows
CREATE POLICY "likes_delete"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Extend notifications.type for like variants ──────────────────────────────
-- Run this block only if your notifications table has a CHECK constraint on the
-- type column. If it is a plain TEXT column with no constraint, skip it.
--
-- ALTER TABLE notifications
--   DROP CONSTRAINT IF EXISTS notifications_type_check;
--
-- ALTER TABLE notifications
--   ADD CONSTRAINT notifications_type_check
--   CHECK (type IN ('follow', 'message', 'like_review', 'like_playlist'));
