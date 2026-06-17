-- ─── Content reports table ───────────────────────────────────────────────────
--
-- Lets users flag objectionable content / abusive users (App Store guideline 1.2).
--
-- content_type   = what is being reported: 'review' | 'comment' | 'user' | 'dm' | 'playlist'
-- content_id     = identifier of the reported item (review key, comment uuid, etc.)
-- reported_user  = the user who created the offending content (so we can eject them)
-- reason         = optional short reason chosen by the reporter
-- status         = 'pending' until a moderator resolves it ('actioned' | 'dismissed')
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type   TEXT        NOT NULL,
  content_id     TEXT        NOT NULL,
  reason         TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup of pending reports for the moderation queue
CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON content_reports (status, created_at);

-- Prevent the same user spamming reports on the same item
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_unique_idx
  ON content_reports (reporter_id, content_type, content_id);

-- Row-level security ──────────────────────────────────────────────────────────

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can file their own reports
CREATE POLICY "content_reports_insert"
  ON content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can see the reports they filed (so the UI can confirm)
CREATE POLICY "content_reports_select_own"
  ON content_reports FOR SELECT
  USING (auth.uid() = reporter_id);
