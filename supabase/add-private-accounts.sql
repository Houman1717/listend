-- ─── Private accounts: follow requests + content visibility ──────────────────
--
-- Before this, "private" only existed in the app UI: following a private
-- account inserted the follows row instantly (no approval), and every private
-- user's library/reviews/playlists stayed readable straight from the API.
--
-- 1. follow_requests — following a private account creates a pending request
--    here instead of a follows row. follows keeps meaning "accepted", so none
--    of the existing follows queries (counts, friends, feeds) change.
--    A BEFORE INSERT trigger on follows enforces this server-side, which also
--    covers older app builds that still insert into follows directly.
-- 2. RESTRICTIVE select policies on the content tables — they AND with the
--    existing permissive policies, so a private user's rows are only readable
--    by themselves and accepted followers. Aggregates that need everyone
--    (album rating averages, artist like counts) go through SECURITY DEFINER
--    RPCs that return numbers, never identities.
--
-- The Express server uses the service role, which bypasses RLS — its
-- identity-bearing responses (Popular Reviews) filter private users in code.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Preflight: every table we restrict must already have RLS on ─────────────
-- A restrictive policy on a table with RLS disabled does nothing, and enabling
-- RLS here blind could lock out reads/writes that currently work. Abort instead.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['follows', 'user_albums', 're_listens', 'want_to_listen', 'playlists', 'playlist_albums', 'liked_artists', 'top5_changes', 'notifications'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.% — stop and check its policies before running this migration', t;
    END IF;
  END LOOP;
END $$;

-- ── follow_requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

CREATE INDEX IF NOT EXISTS follow_requests_target_idx ON follow_requests (target_id, created_at DESC);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

-- Both sides can see and withdraw/decline a request. Creating and accepting go
-- through follow_user() / respond_follow_request() below.
DROP POLICY IF EXISTS "follow_requests_select" ON follow_requests;
CREATE POLICY "follow_requests_select" ON follow_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "follow_requests_delete" ON follow_requests;
CREATE POLICY "follow_requests_delete" ON follow_requests
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- ── Notification types ──────────────────────────────────────────────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'follow_request', 'follow_accepted', 'message', 'like_review', 'like_playlist', 'like_comment', 'like_reply', 'comment', 'comment_reply'));

-- ── Visibility helper ───────────────────────────────────────────────────────
-- True when the caller may read p_owner's content: it's their own, the owner
-- isn't private, or the caller is an accepted follower.
CREATE OR REPLACE FUNCTION public.can_view_user(p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_owner = auth.uid()
    OR NOT COALESCE((SELECT is_private FROM profiles WHERE id = p_owner), false)
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = p_owner
    ),
    false);
$$;

-- ── Follows guard (covers direct inserts and old app builds) ─────────────────
CREATE OR REPLACE FUNCTION public.follows_private_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('listend.accepting_follow', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF COALESCE((SELECT is_private FROM profiles WHERE id = NEW.following_id), false)
     AND NEW.follower_id <> NEW.following_id THEN
    INSERT INTO follow_requests (requester_id, target_id)
    VALUES (NEW.follower_id, NEW.following_id)
    ON CONFLICT (requester_id, target_id) DO NOTHING;
    RETURN NULL; -- no follows row until the owner accepts
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follows_private_guard ON follows;
CREATE TRIGGER follows_private_guard
  BEFORE INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION public.follows_private_guard();

-- Old app builds insert a 'follow' notification right after their follows
-- insert. If that follow was turned into a request, send a request
-- notification instead of "started following you".
CREATE OR REPLACE FUNCTION public.notifications_follow_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'follow' AND NOT EXISTS (
    SELECT 1 FROM follows WHERE follower_id = NEW.actor_id AND following_id = NEW.user_id
  ) THEN
    IF EXISTS (
      SELECT 1 FROM follow_requests WHERE requester_id = NEW.actor_id AND target_id = NEW.user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM notifications WHERE type = 'follow_request' AND actor_id = NEW.actor_id AND user_id = NEW.user_id
    ) THEN
      NEW.type := 'follow_request';
      RETURN NEW;
    END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_follow_guard ON notifications;
CREATE TRIGGER notifications_follow_guard
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_follow_guard();

-- A withdrawn or declined request takes its notification with it.
CREATE OR REPLACE FUNCTION public.follow_requests_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'follow_request' AND user_id = OLD.target_id AND actor_id = OLD.requester_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS follow_requests_cleanup ON follow_requests;
CREATE TRIGGER follow_requests_cleanup
  AFTER DELETE ON follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.follow_requests_cleanup();

-- ── RPC: follow_user ────────────────────────────────────────────────────────
-- Returns 'following' or 'requested'. Also sends the matching notification, so
-- the app never has to guess which one applies.
CREATE OR REPLACE FUNCTION public.follow_user(p_target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_target IS NULL OR p_target = me THEN RAISE EXCEPTION 'invalid target'; END IF;
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = me AND blocked_id = p_target) OR (blocker_id = p_target AND blocked_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF EXISTS (SELECT 1 FROM follows WHERE follower_id = me AND following_id = p_target) THEN
    RETURN 'following';
  END IF;

  IF COALESCE((SELECT is_private FROM profiles WHERE id = p_target), false) THEN
    IF NOT EXISTS (SELECT 1 FROM follow_requests WHERE requester_id = me AND target_id = p_target) THEN
      INSERT INTO follow_requests (requester_id, target_id) VALUES (me, p_target);
      INSERT INTO notifications (user_id, type, actor_id) VALUES (p_target, 'follow_request', me);
    END IF;
    RETURN 'requested';
  END IF;

  INSERT INTO follows (follower_id, following_id) VALUES (me, p_target);
  INSERT INTO notifications (user_id, type, actor_id) VALUES (p_target, 'follow', me);
  RETURN 'following';
END;
$$;

-- ── RPC: respond_follow_request ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_follow_request(p_requester uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM follow_requests WHERE requester_id = p_requester AND target_id = me) THEN
    RETURN; -- already handled (withdrawn, or answered on another device)
  END IF;

  IF p_accept THEN
    PERFORM set_config('listend.accepting_follow', 'on', true);
    IF NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = p_requester AND following_id = me) THEN
      INSERT INTO follows (follower_id, following_id) VALUES (p_requester, me);
    END IF;
    PERFORM set_config('listend.accepting_follow', 'off', true);

    -- The request notification becomes "started following you" (UPDATE, so no
    -- second push), and the requester hears they were accepted.
    UPDATE notifications SET type = 'follow'
    WHERE type = 'follow_request' AND user_id = me AND actor_id = p_requester;
    INSERT INTO notifications (user_id, type, actor_id) VALUES (p_requester, 'follow_accepted', me);
  END IF;

  DELETE FROM follow_requests WHERE requester_id = p_requester AND target_id = me;
END;
$$;

-- ── Going public accepts everything pending ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_accept_requests_on_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_private, false) AND NOT COALESCE(NEW.is_private, false) THEN
    INSERT INTO follows (follower_id, following_id)
    SELECT fr.requester_id, fr.target_id
    FROM follow_requests fr
    WHERE fr.target_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = fr.requester_id AND f.following_id = fr.target_id);

    UPDATE notifications SET type = 'follow'
    WHERE type = 'follow_request' AND user_id = NEW.id;

    DELETE FROM follow_requests WHERE target_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_accept_requests_on_public ON profiles;
CREATE TRIGGER profiles_accept_requests_on_public
  AFTER UPDATE OF is_private ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_accept_requests_on_public();

-- ── Content visibility (restrictive — ANDs with existing policies) ──────────
-- `user_id = (select auth.uid())` first so reading your own rows never pays for
-- the function call.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_albums', 're_listens', 'want_to_listen', 'playlists', 'liked_artists', 'top5_changes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "private_account_select" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "private_account_select" ON public.%I AS RESTRICTIVE FOR SELECT
         USING (user_id = (SELECT auth.uid()) OR public.can_view_user(user_id))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "private_account_select" ON playlist_albums;
CREATE POLICY "private_account_select" ON playlist_albums
  AS RESTRICTIVE FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_albums.playlist_id
      AND (p.user_id = (SELECT auth.uid()) OR public.can_view_user(p.user_id))
  ));

-- ── Anonymous aggregates ────────────────────────────────────────────────────
-- Album ratings from everyone except the caller (the app adds its own), one per
-- user (most recent log). Mirrors album-detail's community reviews query.
CREATE OR REPLACE FUNCTION public.album_community_ratings(p_title text, p_year int)
RETURNS SETOF numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rating::numeric FROM (
    SELECT DISTINCT ON (user_id) user_id, rating
    FROM user_albums
    WHERE title ILIKE p_title
      AND listened_at IS NOT NULL
      AND (COALESCE(p_year, 0) <= 0 OR year = p_year OR year IS NULL OR year = 0)
      AND user_id IS DISTINCT FROM auth.uid()
    ORDER BY user_id, listened_at DESC
  ) latest
  WHERE rating > 0;
$$;

CREATE OR REPLACE FUNCTION public.artist_like_count(p_artist_id text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM liked_artists WHERE artist_id = p_artist_id;
$$;

REVOKE ALL ON FUNCTION public.follows_private_guard()               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notifications_follow_guard()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.follow_requests_cleanup()             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profiles_accept_requests_on_public()  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.follow_user(uuid)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_follow_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_user(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_follow_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid)                   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.album_community_ratings(text, int)    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.artist_like_count(text)               TO authenticated, anon;

COMMIT;
