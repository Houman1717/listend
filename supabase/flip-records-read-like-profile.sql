-- Flip history follows the same visibility as the rest of a profile.
--
-- read_flips used to allow only the owner and their followers, so My Stats'
-- Flip a Record card came back empty on any public profile you didn't follow,
-- even though that profile's albums, reviews and stats were all visible.
-- can_view_user is the shared rule (add-private-accounts.sql): public profiles
-- are readable by anyone, private ones only by approved followers.
--
-- Every app query on flip_records filters by user_id (own history, a viewed
-- profile, or a list of followed friends), so this can't widen any feed.

BEGIN;

DROP POLICY IF EXISTS "read_flips" ON flip_records;
CREATE POLICY "read_flips" ON flip_records
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.can_view_user(user_id));

COMMIT;
