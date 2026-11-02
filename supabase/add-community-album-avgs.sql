-- Community average rating for each album in one user's library, computed in
-- the database for My Stats' "Rated vs community" and "Artists vs community".
--
-- The app used to download every rating of every album sharing a title with
-- the user's (30k rows for a 370-album library, ~30 paged requests) and
-- average them on the phone. This returns one row per album instead.
--
-- Visibility matches the user_albums RLS (private_account_select): ratings
-- from private accounts the caller can't view are left out. It's SECURITY
-- DEFINER because invoking RLS per row made the query ~3s; the rule is
-- applied explicitly via `hidden` (85 private profiles) instead. It refuses
-- to answer for a library the caller can't view, so it can't be used to list
-- a private account's titles.

create or replace function public.community_album_avgs(p_user uuid)
returns table (title_key text, year int, avg_rating numeric, rating_count int)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct lower(title) as t, coalesce(year, 0) as y
    from user_albums
    where user_id = p_user and title is not null
      and can_view_user(p_user)
  ), hidden as materialized (
    select id from profiles where is_private and not can_view_user(id)
  )
  select m.t, m.y, avg(o.rating), count(*)::int
  from user_albums o
  join mine m on lower(o.title) = m.t and coalesce(o.year, 0) = m.y
  where o.rating > 0
    and o.user_id <> p_user
    and o.user_id not in (select id from hidden)
  group by m.t, m.y
$$;

revoke all on function public.community_album_avgs(uuid) from public;
grant execute on function public.community_album_avgs(uuid) to authenticated;
