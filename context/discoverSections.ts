import { SpotifyAlbum, SpotifyArtist } from './SpotifyService';

export const discoverSections: {
  newReleases: SpotifyAlbum[];
  popular: SpotifyAlbum[];
  comingSoon: SpotifyAlbum[];
  classics: SpotifyAlbum[];
  topRated: SpotifyAlbum[];
  topArtists: SpotifyArtist[];
} = {
  newReleases: [],
  popular: [],
  comingSoon: [],
  classics: [],
  topRated: [],
  topArtists: [],
};
