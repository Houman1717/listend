-- Let playlist owners update their own playlist_albums rows, so reordering a
-- playlist can rewrite `position` with a single upsert. Without this, RLS
-- rejects the UPDATE half of the upsert (42501) and the app falls back to
-- delete + insert.
--
-- Run once in the Supabase SQL editor.

DROP POLICY IF EXISTS "playlist_albums_update_own" ON playlist_albums;
CREATE POLICY "playlist_albums_update_own" ON playlist_albums
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_albums.playlist_id
      AND p.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_albums.playlist_id
      AND p.user_id = (SELECT auth.uid())
  ));
