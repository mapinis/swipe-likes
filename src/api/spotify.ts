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

export async function removeSavedTracks(
  client: SpotifyClient,
  ids: string[],
): Promise<void> {
  for (const batch of chunk(ids, 50)) {
    await client.request("/me/tracks", { method: "DELETE", body: { ids: batch } });
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

export function createPlaylist(
  client: SpotifyClient,
  userId: string,
  name: string,
  description = "",
): Promise<Playlist> {
  return client.request<Playlist>(`/users/${userId}/playlists`, {
    method: "POST",
    body: { name, public: false, description },
  });
}

export async function addTracksToPlaylist(
  client: SpotifyClient,
  playlistId: string,
  uris: string[],
): Promise<void> {
  for (const batch of chunk(uris, 100)) {
    await client.request(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: { uris: batch },
    });
  }
}
