import { SpotifyAlbum, SpotifyTrack, SpotifyArtist } from './SpotifyService';

export const discoverSections: {
  newReleases: SpotifyAlbum[];
  popular: SpotifyAlbum[];
  comingSoon: SpotifyAlbum[];
  classics: SpotifyAlbum[];
  topRated: SpotifyAlbum[];
  topArtists: SpotifyArtist[];
  topSongs: SpotifyTrack[];
} = {
  newReleases: [],
  popular: [],
  comingSoon: [],
  classics: [],
  topRated: [],
  topArtists: [],
  topSongs: [],
};
