-- ─── Canonical albums cache ───────────────────────────────────────────────────
--
-- Pins one canonical Apple Music catalog ID per (artist, title) so that
-- independently-seeded lists (genre lists, decade lists, etc.) and album
-- logging all agree on the same ID for what a human considers "the same
-- album" — instead of each list's own search landing on a different catalog
-- entry (e.g. a remaster/anniversary edition nobody asked for).
--
-- normalized_key = normalize(artist) || '::' || normalize(title), where
-- normalize(s) = s.toLowerCase().replace(/[^a-z0-9]/g, '')
--
-- Only ever read/written by the server (service-role key) — never queried
-- directly by the client.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS canonical_albums (
  normalized_key TEXT        PRIMARY KEY,
  canonical_id   TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  artist         TEXT        NOT NULL,
  year           INT,
  artwork_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE canonical_albums ENABLE ROW LEVEL SECURITY;
-- No public policies — only the server's service-role key touches this table,
-- which bypasses RLS entirely.
