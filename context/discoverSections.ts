import { CatalogAlbum, CatalogTrack, CatalogArtist } from './CatalogService';

export const discoverSections: {
  newReleases: CatalogAlbum[];
  popular: CatalogAlbum[];
  comingSoon: CatalogAlbum[];
  classics: CatalogAlbum[];
  topRated: CatalogAlbum[];
  topArtists: CatalogArtist[];
  mostListendSongs: CatalogTrack[];
  highestRatedSongs: CatalogTrack[];
} = {
  newReleases: [],
  popular: [],
  comingSoon: [],
  classics: [],
  topRated: [],
  topArtists: [],
  mostListendSongs: [],
  highestRatedSongs: [],
};
