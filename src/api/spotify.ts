import type { SpotifyClient, Page } from "./client.ts";
import type {
  Artist,
  CurrentUser,
  Playlist,
  RecentlyPlayedItem,
  SavedTrack,
  TimeRange,
  Track,
} from "./types.ts";

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function getCurrentUser(client: SpotifyClient): Promise<CurrentUser> {
  return client.request<CurrentUser>("/me");
}

export function getAllSavedTracks(
  client: SpotifyClient,
  onProgress?: (collected: number, total: number | null) => void,
): Promise<SavedTrack[]> {
  return client.getAllPages<SavedTrack>("/me/tracks", { limit: 50 }, onProgress);
}

export async function getTopTracks(
  client: SpotifyClient,
  timeRange: TimeRange,
): Promise<Track[]> {
  const page = await client.request<Page<Track>>("/me/top/tracks", {
    query: { time_range: timeRange, limit: 50 },
  });
  return page.items;
}

export async function getTopArtists(
  client: SpotifyClient,
  timeRange: TimeRange,
): Promise<Artist[]> {
  const page = await client.request<Page<Artist>>("/me/top/artists", {
    query: { time_range: timeRange, limit: 50 },
  });
  return page.items;
}

export function getRecentlyPlayed(
  client: SpotifyClient,
  maxPages = 20,
): Promise<RecentlyPlayedItem[]> {
  return client.getAllPages<RecentlyPlayedItem>(
    "/me/player/recently-played",
    { limit: 50 },
    undefined,
    maxPages,
  );
}

export async function getArtists(
  client: SpotifyClient,
  ids: string[],
): Promise<Artist[]> {
  const out: Artist[] = [];
  for (const batch of chunk([...new Set(ids)], 50)) {
    const res = await client.request<{ artists: Artist[] }>("/artists", {
      query: { ids: batch.join(",") },
    });
    out.push(...res.artists.filter(Boolean));
  }
  return out;
}

// Feb 2026 migration: DELETE /me/tracks → DELETE /me/library. URIs (not IDs)
// go in the `uris` QUERY param as a comma-separated list, max 40 per request.
export async function removeSavedTracks(
  client: SpotifyClient,
  uris: string[],
): Promise<void> {
  for (const batch of chunk(uris, 40)) {
    await client.request("/me/library", {
      method: "DELETE",
      query: { uris: batch.join(",") },
    });
  }
}

export async function getMyPlaylists(
  client: SpotifyClient,
): Promise<Playlist[]> {
  return client.getAllPages<Playlist>("/me/playlists", { limit: 50 });
}

export async function findPlaylistByName(
  client: SpotifyClient,
  userId: string,
  name: string,
): Promise<Playlist | null> {
  const playlists = await getMyPlaylists(client);
  return (
    playlists.find((p) => p.owner.id === userId && p.name === name) ?? null
  );
}

// Feb 2026 migration: POST /users/{id}/playlists → POST /me/playlists.
export function createPlaylist(
  client: SpotifyClient,
  name: string,
  description = "",
): Promise<Playlist> {
  return client.request<Playlist>("/me/playlists", {
    method: "POST",
    body: { name, public: false, description },
  });
}

// Feb 2026 migration: POST /playlists/{id}/tracks → POST /playlists/{id}/items.
export async function addTracksToPlaylist(
  client: SpotifyClient,
  playlistId: string,
  uris: string[],
): Promise<void> {
  for (const batch of chunk(uris, 100)) {
    await client.request(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: { uris: batch },
    });
  }
}

interface PlaylistItem {
  track?: { uri?: string };
  item?: { uri?: string };
}

/** URIs already in a playlist, so re-running a commit doesn't add duplicates. */
export async function getPlaylistItemUris(
  client: SpotifyClient,
  playlistId: string,
): Promise<Set<string>> {
  const items = await client.getAllPages<PlaylistItem>(
    `/playlists/${playlistId}/items`,
    { limit: 50 },
  );
  const uris = new Set<string>();
  for (const el of items) {
    const uri = el.track?.uri ?? el.item?.uri;
    if (uri) uris.add(uri);
  }
  return uris;
}
