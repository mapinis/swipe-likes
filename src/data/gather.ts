import type { SpotifyClient } from "../api/client.ts";
import {
  getAllSavedTracks,
  getCurrentUser,
  getRecentlyPlayed,
  getTopArtists,
  getTopTracks,
} from "../api/spotify.ts";
import type { TimeRange } from "../api/types.ts";
import type { Snapshot } from "./cache.ts";

export interface GatherProgress {
  phase: string;
  collected?: number;
  total?: number | null;
}

const TERMS: TimeRange[] = ["short_term", "medium_term", "long_term"];

export async function gatherSnapshot(
  client: SpotifyClient,
  onProgress?: (p: GatherProgress) => void,
): Promise<Snapshot> {
  const report = (p: GatherProgress) => onProgress?.(p);

  report({ phase: "Reading your profile" });
  const user = await getCurrentUser(client);

  report({ phase: "Loading your liked songs", collected: 0, total: null });
  const savedTracks = await getAllSavedTracks(client, (collected, total) =>
    report({ phase: "Loading your liked songs", collected, total }),
  );

  report({ phase: "Analyzing what you actually play" });
  const [topTracks, topArtists] = await Promise.all([
    Promise.all(TERMS.map((t) => getTopTracks(client, t))),
    Promise.all(TERMS.map((t) => getTopArtists(client, t))),
  ]);

  const topTrackIds = {
    short: topTracks[0].map((t) => t.id),
    medium: topTracks[1].map((t) => t.id),
    long: topTracks[2].map((t) => t.id),
  };
  const topArtistIds = {
    short: topArtists[0].map((a) => a.id),
    medium: topArtists[1].map((a) => a.id),
    long: topArtists[2].map((a) => a.id),
  };

  report({ phase: "Checking recent plays" });
  const recent = await getRecentlyPlayed(client);
  const recentlyPlayedTrackIds = new Set<string>();
  const recentlyPlayedArtistIds = new Set<string>();
  for (const item of recent) {
    recentlyPlayedTrackIds.add(item.track.id);
    for (const a of item.track.artists) recentlyPlayedArtistIds.add(a.id);
  }

  return {
    fetchedAt: Date.now(),
    user,
    savedTracks,
    topTrackIds,
    topArtistIds,
    recentlyPlayedTrackIds: [...recentlyPlayedTrackIds],
    recentlyPlayedArtistIds: [...recentlyPlayedArtistIds],
  };
}
