# Listend Server

Node.js + Express backend that proxies Spotify data through Supabase so the mobile app never touches Spotify credentials directly.

## Architecture

```
Mobile app  →  GET /home, /genres, /decades  →  Supabase (cached data)
                                                        ↑
                                              Cron job (every 6h)
                                                        ↑
                                              Spotify API (server-side)
```

## Supabase setup

Run the following SQL in the Supabase SQL editor (**Dashboard → SQL Editor → New query**):

```sql
-- Home screen data
CREATE TABLE home_albums (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id  text UNIQUE NOT NULL,
  title       text NOT NULL,
  artist      text NOT NULL,
  artwork_url text DEFAULT '',
  year        smallint DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE home_songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id  text UNIQUE NOT NULL,
  title       text NOT NULL,
  artist      text NOT NULL,
  artwork_url text DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE home_artists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id  text UNIQUE NOT NULL,
  name        text NOT NULL,
  artwork_url text DEFAULT '',
  genre       text DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

-- Discover: by genre
CREATE TABLE genre_albums (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id  text NOT NULL,
  genre_label text NOT NULL,
  title       text NOT NULL,
  artist      text NOT NULL,
  artwork_url text DEFAULT '',
  year        smallint DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (genre_label, spotify_id)
);

-- Discover: by decade
CREATE TABLE decade_albums (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id   text NOT NULL,
  decade_label text NOT NULL,
  title        text NOT NULL,
  artist       text NOT NULL,
  artwork_url  text DEFAULT '',
  year         smallint DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (decade_label, spotify_id)
);
```

## Local development

```bash
cd listend-server
cp .env.example .env
# Fill in SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY

npm install
npm run dev      # uses node --watch (Node 18+), auto-restarts on file changes
```

The server starts on `http://localhost:3000` and immediately runs a full data refresh.

## Deploying to Railway

1. **Create a new Railway project** and connect your GitHub repo.
2. Set the **Root Directory** to `listend-server`.
3. Railway auto-detects Node.js and runs `npm start`.
4. Add the following **environment variables** in Railway → Variables:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - (`PORT` is set automatically by Railway — do not override it)
5. Deploy. Once the deploy finishes, copy the public URL (e.g. `https://listend-server-production.up.railway.app`).
6. Set `EXPO_PUBLIC_API_URL` in your React Native `.env` to that URL.

## Endpoints

| Method | Path       | Description                                      |
|--------|------------|--------------------------------------------------|
| GET    | `/health`  | Returns `{ ok: true }` — use for Railway health checks |
| GET    | `/home`    | `{ albums, songs, artists }` from Supabase       |
| GET    | `/genres`  | `{ Rap: [...], 'R&B': [...], ... }` from Supabase|
| GET    | `/decades` | `{ '1950s': [...], '1960s': [...], ... }`        |

## Cron schedule

The server runs `runRefresh()` on startup and then every 6 hours (`0 */6 * * *`). Each refresh fetches ~170 Spotify search results sequentially with 120 ms gaps (~20 seconds total) and upserts them into Supabase.
