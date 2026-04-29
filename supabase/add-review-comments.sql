-- ─── Review comments table ───────────────────────────────────────────────────
--
-- review_id      = the composite review key: '{reviewer_user_id}_{spotify_id}'
--                  (matches target_id format used in the likes table)
-- parent_comment_id = NULL for top-level comments, set to parent id for replies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         TEXT        NOT NULL,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID        REFERENCES review_comments(id) ON DELETE CASCADE,
  body              TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup of all comments on a review
CREATE INDEX IF NOT EXISTS review_comments_review_id_idx
  ON review_comments (review_id, created_at);

-- Index for fast lookup of replies to a comment
CREATE INDEX IF NOT EXISTS review_comments_parent_idx
  ON review_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- Row-level security ──────────────────────────────────────────────────────────

ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments
CREATE POLICY "review_comments_select"
  ON review_comments FOR SELECT
  USING (true);

-- Users can only insert their own comments
CREATE POLICY "review_comments_insert"
  ON review_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own comments
CREATE POLICY "review_comments_delete"
  ON review_comments FOR DELETE
  USING (auth.uid() = user_id);
