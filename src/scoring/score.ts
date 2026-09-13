import type { SavedTrack } from "../api/types.ts";
import {
  DEFAULT_CONFIG,
  RECENT_ARTIST_KEEP,
  RECENT_TRACK_KEEP,
  TOP_TIER_KEEP,
  type ScoringConfig,
  type ScoringWeights,
} from "./weights.ts";

const DAY_MS = 86_400_000;

export interface TermSets {
  short: Set<string>;
  medium: Set<string>;
  long: Set<string>;
}

export interface ScoringInput {
  savedTracks: SavedTrack[];
  topTrackIds: TermSets;
  topArtistIds: TermSets;
  recentlyPlayedTrackIds: Set<string>;
  recentlyPlayedArtistIds: Set<string>;
  now?: number;
}

export interface ScoreFactors {
  age: number;
  artistCold: number;
  artistThin: number;
  topTrackKeep: number;
  topArtistKeep: number;
  recentKeep: number;
}

export interface ScoredTrack {
  saved: SavedTrack;
  score: number; // 0..100 percentile across the library, higher = toss first
  raw: number; // pre-percentile toss pressure (can be negative)
  factors: ScoreFactors;
  reasons: string[];
}

interface ArtistAgg {
  count: number;
  lastLikedAt: number;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function termKeep(id: string, sets: TermSets): number {
  if (sets.short.has(id)) return TOP_TIER_KEEP.short;
  if (sets.medium.has(id)) return TOP_TIER_KEEP.medium;
  if (sets.long.has(id)) return TOP_TIER_KEEP.long;
  return 0;
}

function buildArtistAggregates(saved: SavedTrack[]): Map<string, ArtistAgg> {
  const map = new Map<string, ArtistAgg>();
  for (const s of saved) {
    const at = Date.parse(s.added_at);
    for (const a of s.track.artists) {
      const prev = map.get(a.id);
      if (prev) {
        prev.count += 1;
        if (at > prev.lastLikedAt) prev.lastLikedAt = at;
      } else {
        map.set(a.id, { count: 1, lastLikedAt: at });
      }
    }
  }
  return map;
}

function computeFactors(
  input: ScoringInput,
  saved: SavedTrack,
  agg: Map<string, ArtistAgg>,
  config: ScoringConfig,
  now: number,
): ScoreFactors {
  const t = saved.track;
  const artistIds = t.artists.map((a) => a.id);
  const { horizons } = config;

  const ageDays = Math.max(0, (now - Date.parse(saved.added_at)) / DAY_MS);

  const artistStats = artistIds
    .map((id) => agg.get(id))
    .filter(Boolean) as ArtistAgg[];
  const lastLikedAt = artistStats.length
    ? Math.max(...artistStats.map((a) => a.lastLikedAt))
    : Date.parse(saved.added_at);
  const coldDays = Math.max(0, (now - lastLikedAt) / DAY_MS);
  const artistCount = artistStats.length
    ? Math.max(...artistStats.map((a) => a.count))
    : 1;

  const topArtistKeep = artistIds.length
    ? Math.max(...artistIds.map((id) => termKeep(id, input.topArtistIds)))
    : 0;
  const recentKeep = input.recentlyPlayedTrackIds.has(t.id)
    ? RECENT_TRACK_KEEP
    : artistIds.some((id) => input.recentlyPlayedArtistIds.has(id))
      ? RECENT_ARTIST_KEEP
      : 0;

  return {
    age: clamp01(ageDays / horizons.ageDays),
    artistCold: clamp01(coldDays / horizons.artistColdDays),
    artistThin: 1 - clamp01(artistCount / horizons.artistCountSat),
    topTrackKeep: termKeep(t.id, input.topTrackIds),
    topArtistKeep,
    recentKeep,
  };
}

export function rawScore(f: ScoreFactors, w: ScoringWeights): number {
  return (
    w.age * f.age +
    w.artistCold * f.artistCold +
    w.artistThin * f.artistThin -
    w.topTrack * f.topTrackKeep -
    w.topArtist * f.topArtistKeep -
    w.recentPlay * f.recentKeep
  );
}

function humanAge(days: number): string {
  if (days >= 365) return `${Math.round(days / 365)}y ago`;
  return `${Math.max(1, Math.round(days / 30))}mo ago`;
}

function buildReasons(
  saved: SavedTrack,
  f: ScoreFactors,
  w: ScoringWeights,
  now: number,
  artistCount: number,
): string[] {
  const artist = saved.track.artists[0]?.name ?? "this artist";
  const ageDays = Math.max(0, (now - Date.parse(saved.added_at)) / DAY_MS);

  const toss: Array<{ weight: number; text: string }> = [];
  if (w.age * f.age > 0.1) toss.push({ weight: w.age * f.age, text: `Liked ${humanAge(ageDays)}` });
  if (artistCount > 1 && w.artistCold * f.artistCold > 0.1)
    toss.push({ weight: w.artistCold * f.artistCold, text: `Cooled on ${artist}` });
  if (w.artistThin * f.artistThin > 0.1)
    toss.push({
      weight: w.artistThin * f.artistThin,
      text: artistCount <= 1 ? `Only song you liked by ${artist}` : `Few songs by ${artist}`,
    });

  const reasons = toss
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => r.text);

  if (reasons.length < 3) {
    if (f.topTrackKeep > 0) reasons.push("One of your top tracks");
    else if (f.topArtistKeep > 0) reasons.push(`You still play ${artist}`);
    else if (f.recentKeep > 0) reasons.push("Played recently");
  }
  return reasons.slice(0, 3);
}

export function scoreLibrary(
  input: ScoringInput,
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoredTrack[] {
  const now = input.now ?? Date.now();
  const agg = buildArtistAggregates(input.savedTracks);

  const scored = input.savedTracks.map((saved) => {
    const factors = computeFactors(input, saved, agg, config, now);
    const artistCount = Math.max(
      1,
      ...saved.track.artists.map((a) => agg.get(a.id)?.count ?? 1),
    );
    return {
      saved,
      score: 0,
      raw: rawScore(factors, config.weights),
      factors,
      reasons: buildReasons(saved, factors, config.weights, now, artistCount),
    };
  });

  scored.sort(
    (a, b) =>
      b.raw - a.raw ||
      Date.parse(a.saved.added_at) - Date.parse(b.saved.added_at),
  );

  const n = scored.length;
  scored.forEach((s, i) => {
    s.score = n <= 1 ? 100 : Math.round(((n - 1 - i) / (n - 1)) * 100);
  });
  return scored;
}
