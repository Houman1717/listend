-- No self-follows (applied 2026-11-08).
--
-- follow_user() already rejected p_target = me, but the follows insert policy
-- only checks auth.uid() = follower_id, so direct inserts (older builds) could
-- still write follower_id = following_id. 8 accounts had done so, the latest
-- on 2026-10-22. A CHECK constraint closes it for every path, service role
-- included.

-- Clean up the bad rows first (the unfollow trigger drops any bell row) and the
-- "X started following you" notifications they sent to themselves.
DELETE FROM public.follows WHERE follower_id = following_id;
DELETE FROM public.follow_requests WHERE requester_id = target_id;
DELETE FROM public.notifications
WHERE user_id = actor_id AND type IN ('follow', 'follow_request', 'follow_accepted');

ALTER TABLE public.follows
  ADD CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id);
ALTER TABLE public.follow_requests
  ADD CONSTRAINT follow_requests_no_self_request CHECK (requester_id <> target_id);
