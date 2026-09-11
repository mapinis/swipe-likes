import type { SavedTrack } from "../api/types.ts";
import {
  RECENT_ARTIST_LIKE_DAYS,
  STALE_MAX_DAYS,
  WEIGHTS,
  type FactorName,
  type FactorWeights,
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
  activeGenres: Set<string>;
  artistGenres: Map<string, string[]>;
  now?: number;
}

interface ArtistAgg {
  count: number;
  lastLikedAt: number;
}

export interface ScoredTrack {
  saved: SavedTrack;
  score: number; // 0..100, higher = toss first
  factors: Partial<Record<FactorName, number>>; // available factors, 0..1
  reasons: string[];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function termScore(
  id: string,
  sets: TermSets,
  others: () => boolean,
): number {
  if (sets.short.has(id)) return 0;
  if (sets.medium.has(id)) return 0.2;
  if (sets.long.has(id)) return 0.4;
  return others() ? 0.4 : 1;
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

function ageDays(addedAt: string, now: number): number {
  return Math.max(0, (now - Date.parse(addedAt)) / DAY_MS);
}

interface FactorResult {
  factors: Partial<Record<FactorName, number>>;
}

function computeFactors(
  input: ScoringInput,
  saved: SavedTrack,
  artistAgg: Map<string, ArtistAgg>,
  now: number,
): FactorResult {
  const t = saved.track;
  const artistIds = t.artists.map((a) => a.id);
  const factors: Partial<Record<FactorName, number>> = {};

  // Stale like — older is more tossable.
  factors.staleLike = clamp01(ageDays(saved.added_at, now) / STALE_MAX_DAYS);

  // Not a top track.
  factors.notTopTrack = termScore(t.id, input.topTrackIds, () => false);

  // Artist not among top artists (any credited artist counts).
  factors.artistNotTop = Math.min(
    ...artistIds.map((id) => termScore(id, input.topArtistIds, () => false)),
  );

  // Not played recently.
  if (input.recentlyPlayedTrackIds.has(t.id)) {
    factors.notRecentlyPlayed = 0;
  } else if (artistIds.some((id) => input.recentlyPlayedArtistIds.has(id))) {
    factors.notRecentlyPlayed = 0.5;
  } else {
    factors.notRecentlyPlayed = 1;
  }

  // Genre drift — only if we have genre data for the artist and a genre profile.
  const genres = artistIds.flatMap((id) => input.artistGenres.get(id) ?? []);
  if (input.activeGenres.size > 0 && genres.length > 0) {
    const overlap = genres.some((g) => input.activeGenres.has(g));
    factors.genreDrift = overlap ? 0 : 1;
  }

  // Artist abandonment — derived from the library's own like history.
  const aggs = artistIds.map((id) => artistAgg.get(id)).filter(Boolean) as ArtistAgg[];
  const recentArtistLike = aggs.some(
    (a) => (now - a.lastLikedAt) / DAY_MS <= RECENT_ARTIST_LIKE_DAYS,
  );
  const maxCount = aggs.length ? Math.max(...aggs.map((a) => a.count)) : 1;
  if (recentArtistLike) {
    factors.artistAbandonment = 0.1;
  } else if (maxCount >= 8) {
    factors.artistAbandonment = 0.3;
  } else if (maxCount >= 3) {
    factors.artistAbandonment = 0.6;
  } else {
    factors.artistAbandonment = 1;
  }

  return { factors };
}

export function combineScore(
  factors: Partial<Record<FactorName, number>>,
  weights: FactorWeights = WEIGHTS,
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const name of Object.keys(weights) as FactorName[]) {
    const v = factors[name];
    if (v === undefined) continue;
    weighted += v * weights[name];
    totalWeight += weights[name];
  }
  if (totalWeight === 0) return 0;
  return Math.round((weighted / totalWeight) * 100);
}

function humanAge(days: number): string {
  if (days >= 365) {
    const y = Math.round(days / 365);
    return `${y}y ago`;
  }
  const m = Math.max(1, Math.round(days / 30));
  return `${m}mo ago`;
}

function buildReasons(
  saved: SavedTrack,
  factors: Partial<Record<FactorName, number>>,
  now: number,
  weights: FactorWeights,
): string[] {
  const artistName = saved.track.artists[0]?.name ?? "this artist";
  const phrase: Partial<Record<FactorName, string>> = {
    staleLike: `Liked ${humanAge(ageDays(saved.added_at, now))}`,
    notTopTrack: "Not one of your top tracks",
    artistNotTop: `You rarely play ${artistName}`,
    notRecentlyPlayed: "Not played recently",
    genreDrift: "Off your current genres",
    artistAbandonment: `Few recent likes from ${artistName}`,
  };
  return (Object.keys(weights) as FactorName[])
    .map((name) => ({
      name,
      contribution: (factors[name] ?? 0) * weights[name],
      value: factors[name] ?? 0,
    }))
    .filter((f) => f.value >= 0.5 && f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((f) => phrase[f.name]!)
    .filter(Boolean);
}

export function scoreLibrary(
  input: ScoringInput,
  weights: FactorWeights = WEIGHTS,
): ScoredTrack[] {
  const now = input.now ?? Date.now();
  const artistAgg = buildArtistAggregates(input.savedTracks);

  const scored = input.savedTracks.map((saved) => {
    const { factors } = computeFactors(input, saved, artistAgg, now);
    const score = combineScore(factors, weights);
    return {
      saved,
      score,
      factors,
      reasons: buildReasons(saved, factors, now, weights),
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(a.saved.added_at) - Date.parse(b.saved.added_at),
  );
  return scored;
}
