import type { SpotifyClient } from "../api/client.ts";
import {
  addTracksToPlaylist,
  createPlaylist,
  findPlaylistByName,
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
  await addTracksToPlaylist(
    client,
    playlist.id,
    items.map((i) => i.uri),
  );

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
