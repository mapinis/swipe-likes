export interface ArtistRef {
  id: string;
  name: string;
}

export interface Artist extends ArtistRef {
  genres?: string[];
}

export interface AlbumImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface TrackAlbum {
  name: string;
  images: AlbumImage[];
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  popularity?: number;
  artists: ArtistRef[];
  album: TrackAlbum;
}

export interface SavedTrack {
  added_at: string;
  track: Track;
}

export interface RecentlyPlayedItem {
  track: Track;
  played_at: string;
}

export interface CurrentUser {
  id: string;
  display_name: string | null;
  product?: string;
}

export interface Playlist {
  id: string;
  name: string;
  uri: string;
  owner: { id: string };
}

export type TimeRange = "short_term" | "medium_term" | "long_term";
