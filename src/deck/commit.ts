import type { SpotifyClient } from "../api/client.ts";
import {
  addTracksToPlaylist,
  createPlaylist,
  findPlaylistByName,
  getPlaylistItemUris,
  removeSavedTracks,
} from "../api/spotify.ts";
import { SWIPED_OUT_PLAYLIST_NAME } from "../config.ts";

export interface TossItem {
  id: string;
  uri: string;
}

export interface CommitProgress {
  phase: "playlist" | "backup" | "remove" | "done";
  message: string;
}

export interface CommitResult {
  playlistId: string;
  removed: number;
}

export async function commitToss(
  client: SpotifyClient,
  userId: string,
  items: TossItem[],
  onProgress?: (p: CommitProgress) => void,
): Promise<CommitResult> {
  if (items.length === 0) return { playlistId: "", removed: 0 };

  onProgress?.({ phase: "playlist", message: "Finding backup playlist…" });
  let playlist = await findPlaylistByName(
    client,
    userId,
    SWIPED_OUT_PLAYLIST_NAME,
  );
  if (!playlist) {
    playlist = await createPlaylist(
      client,
      SWIPED_OUT_PLAYLIST_NAME,
      "Songs swiped out of Liked Songs — your recovery net.",
    );
  }

  onProgress?.({
    phase: "backup",
    message: `Backing up ${items.length} songs to "${SWIPED_OUT_PLAYLIST_NAME}"…`,
  });
  // Skip tracks already backed up so a re-run (e.g. after a failed removal)
  // doesn't create duplicates.
  const already = await getPlaylistItemUris(client, playlist.id).catch(
    () => new Set<string>(),
  );
  const toAdd = items.filter((i) => !already.has(i.uri)).map((i) => i.uri);
  if (toAdd.length > 0) await addTracksToPlaylist(client, playlist.id, toAdd);

  onProgress?.({
    phase: "remove",
    message: `Removing ${items.length} songs from Liked Songs…`,
  });
  await removeSavedTracks(
    client,
    items.map((i) => i.uri),
  );

  onProgress?.({ phase: "done", message: "Done." });
  return { playlistId: playlist.id, removed: items.length };
}
