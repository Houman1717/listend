import { SpotifyAlbum } from './SpotifyService';

export const discoverSections: {
  newReleases: SpotifyAlbum[];
  popular: SpotifyAlbum[];
  classics: SpotifyAlbum[];
  topRated: SpotifyAlbum[];
  recommended: SpotifyAlbum[];
} = {
  newReleases: [],
  popular: [],
  classics: [],
  topRated: [],
  recommended: [],
};
