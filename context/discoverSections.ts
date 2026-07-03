import { CatalogAlbum, CatalogTrack, CatalogArtist } from './CatalogService';

export const discoverSections: {
  newReleases: CatalogAlbum[];
  popular: CatalogAlbum[];
  comingSoon: CatalogAlbum[];
  classics: CatalogAlbum[];
  topRated: CatalogAlbum[];
  topArtists: CatalogArtist[];
  topSongs: CatalogTrack[];
} = {
  newReleases: [],
  popular: [],
  comingSoon: [],
  classics: [],
  topRated: [],
  topArtists: [],
  topSongs: [],
};
