-- Curated, ordered replacement for the old chart-based "New Releases"
-- section. position preserves the intended display order (rank 0 = first).
CREATE TABLE IF NOT EXISTS new_release_albums (
  position    INT  PRIMARY KEY,
  spotify_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  artwork_url TEXT,
  year        INT
);
