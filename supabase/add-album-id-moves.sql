-- Album ids whose logs were moved to another id (an edition fix: Bleach
-- deluxe → plain, EUSEXUA alternate → original). Phones running the app
-- before the AlbumsContext synced-ids fix still hold the old id locally and
-- re-save it on a later launch, so the move undid itself as a duplicate log.
-- This trigger drops an insert of a moved id for anyone who already has the
-- id it moved to. Add a row here whenever logs are moved between album ids.

create table if not exists public.album_id_moves (
  old_id   text primary key,
  new_id   text not null,
  moved_at timestamptz not null default now(),
  note     text
);

-- Read only by the trigger below (security definer). No Data API access.
alter table public.album_id_moves enable row level security;

insert into public.album_id_moves (old_id, new_id, moved_at, note) values
  ('669728060',  '6830857209', '2026-11-16', 'Nirvana — Bleach (Deluxe Edition) → Bleach'),
  ('1852333140', '1767658574', '2026-11-19', 'FKA twigs — EUSEXUA alternate tracklist → original')
on conflict (old_id) do nothing;

create or replace function public.skip_moved_album_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from album_id_moves m
    join user_albums u on u.user_id = new.user_id and u.spotify_id = m.new_id
    where m.old_id = new.spotify_id
  ) then
    return null; -- already logged under the id it moved to
  end if;
  return new;
end;
$$;

drop trigger if exists user_albums_skip_moved_ids on public.user_albums;
create trigger user_albums_skip_moved_ids
  before insert on public.user_albums
  for each row execute function public.skip_moved_album_insert();
