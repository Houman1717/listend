// Every song tap in the app opens the Song page through here.

export type OpenSongParams = {
  /** Songs without a catalog id (rare) can't open a page. */
  id?:          string;
  title:        string;
  artist:       string;
  artworkUrl?:  string;
  albumId?:     string;
  albumTitle?:  string;
  releaseDate?: string;
  durationMs?:  number;
};

export function openSongPage(router: { push: (href: any) => void }, song: OpenSongParams, opts?: { edit?: boolean }) {
  if (!song.id) return;
  router.push({
    pathname: '/song-detail',
    params: {
      id:          song.id,
      title:       song.title,
      artist:      song.artist,
      artworkUrl:  song.artworkUrl ?? '',
      albumId:     song.albumId ?? '',
      albumTitle:  song.albumTitle ?? '',
      releaseDate: song.releaseDate ?? '',
      durationMs:  song.durationMs ? String(song.durationMs) : '',
      ...(opts?.edit ? { edit: '1' } : {}),
    },
  });
}
