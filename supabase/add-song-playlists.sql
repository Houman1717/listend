-- ─── Song playlists ──────────────────────────────────────────────────────────
--
-- Playlists of songs, kept completely separate from album playlists
-- (playlists / playlist_albums are untouched) so the two never mix.
--
-- song_playlist_items carries each song's display metadata, so a playlist can
-- render without the songs being logged anywhere.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS song_playlists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description text        CHECK (description IS NULL OR char_length(description) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS song_playlists_user_idx ON song_playlists (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS song_playlist_items (
  playlist_id  uuid        NOT NULL REFERENCES song_playlists(id) ON DELETE CASCADE,
  song_id      text        NOT NULL,
  position     integer     NOT NULL DEFAULT 0,
  title        text        NOT NULL,
  artist       text        NOT NULL,
  album_id     text,
  album_title  text,
  artwork_url  text,
  duration_ms  integer,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, song_id)
);

CREATE INDEX IF NOT EXISTS song_playlist_items_order_idx ON song_playlist_items (playlist_id, position);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE song_playlists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_playlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_playlists_select" ON song_playlists;
CREATE POLICY "song_playlists_select" ON song_playlists FOR SELECT USING (true);

-- Same private-account rule as album playlists (see add-private-accounts.sql).
DROP POLICY IF EXISTS "private_account_select" ON song_playlists;
CREATE POLICY "private_account_select" ON song_playlists
  AS RESTRICTIVE FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.can_view_user(user_id));

DROP POLICY IF EXISTS "song_playlists_insert" ON song_playlists;
CREATE POLICY "song_playlists_insert" ON song_playlists FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_playlists_update" ON song_playlists;
CREATE POLICY "song_playlists_update" ON song_playlists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "song_playlists_delete" ON song_playlists;
CREATE POLICY "song_playlists_delete" ON song_playlists FOR DELETE USING (auth.uid() = user_id);

-- Items follow their playlist: readable when the playlist is, writable by its owner.
DROP POLICY IF EXISTS "song_playlist_items_select" ON song_playlist_items;
CREATE POLICY "song_playlist_items_select" ON song_playlist_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "private_account_select" ON song_playlist_items;
CREATE POLICY "private_account_select" ON song_playlist_items
  AS RESTRICTIVE FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM song_playlists p
    WHERE p.id = song_playlist_items.playlist_id
      AND (p.user_id = (SELECT auth.uid()) OR public.can_view_user(p.user_id))
  ));

DROP POLICY IF EXISTS "song_playlist_items_insert" ON song_playlist_items;
CREATE POLICY "song_playlist_items_insert" ON song_playlist_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM song_playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "song_playlist_items_update" ON song_playlist_items;
CREATE POLICY "song_playlist_items_update" ON song_playlist_items FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM song_playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM song_playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "song_playlist_items_delete" ON song_playlist_items;
CREATE POLICY "song_playlist_items_delete" ON song_playlist_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM song_playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()));

COMMIT;
