import { openDB, type IDBPDatabase } from "idb";
import type { CurrentUser, SavedTrack } from "../api/types.ts";
import type { ScoringInput } from "../scoring/score.ts";

const DB_NAME = "spotify-swipe";
const STORE = "kv";
const SNAPSHOT_KEY = "library-snapshot";

/** Serializable (JSON/structured-clone friendly) form of the gathered data. */
export interface Snapshot {
  fetchedAt: number;
  user: CurrentUser;
  savedTracks: SavedTrack[];
  topTrackIds: { short: string[]; medium: string[]; long: string[] };
  topArtistIds: { short: string[]; medium: string[]; long: string[] };
  recentlyPlayedTrackIds: string[];
  recentlyPlayedArtistIds: string[];
  activeGenres: string[];
  artistGenres: [string, string[]][];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function saveSnapshot(snap: Snapshot): Promise<void> {
  (await db()).put(STORE, snap, SNAPSHOT_KEY);
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    return (await (await db()).get(STORE, SNAPSHOT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  (await db()).delete(STORE, SNAPSHOT_KEY);
}

export function toScoringInput(snap: Snapshot): ScoringInput {
  return {
    savedTracks: snap.savedTracks,
    topTrackIds: {
      short: new Set(snap.topTrackIds.short),
      medium: new Set(snap.topTrackIds.medium),
      long: new Set(snap.topTrackIds.long),
    },
    topArtistIds: {
      short: new Set(snap.topArtistIds.short),
      medium: new Set(snap.topArtistIds.medium),
      long: new Set(snap.topArtistIds.long),
    },
    recentlyPlayedTrackIds: new Set(snap.recentlyPlayedTrackIds),
    recentlyPlayedArtistIds: new Set(snap.recentlyPlayedArtistIds),
    activeGenres: new Set(snap.activeGenres),
    artistGenres: new Map(snap.artistGenres),
  };
}
