import type { SavedTrack } from "../api/types.ts";
import { scoreLibrary, type ScoringInput } from "./score.ts";
import { DEFAULT_CONFIG } from "./weights.ts";

const NOW = Date.parse("2026-09-13T00:00:00Z");
const DAY = 86_400_000;

function mk(id: string, artistId: string, ageDays: number): SavedTrack {
  return {
    added_at: new Date(NOW - ageDays * DAY).toISOString(),
    track: {
      id,
      name: id,
      uri: `spotify:track:${id}`,
      duration_ms: 1,
      artists: [{ id: artistId, name: artistId }],
      album: { name: "", images: [] },
    },
  };
}

function baseInput(
  saved: SavedTrack[],
  opts: {
    topTracksShort?: string[];
    topArtistsShort?: string[];
    recentTracks?: string[];
    recentArtists?: string[];
  } = {},
): ScoringInput {
  return {
    savedTracks: saved,
    topTrackIds: {
      short: new Set(opts.topTracksShort ?? []),
      medium: new Set(),
      long: new Set(),
    },
    topArtistIds: {
      short: new Set(opts.topArtistsShort ?? []),
      medium: new Set(),
      long: new Set(),
    },
    recentlyPlayedTrackIds: new Set(opts.recentTracks ?? []),
    recentlyPlayedArtistIds: new Set(opts.recentArtists ?? []),
    now: NOW,
  };
}

const scoreOf = (
  ranked: ReturnType<typeof scoreLibrary>,
  id: string,
): number => ranked.find((r) => r.saved.track.id === id)!.score;

test("percentile spread: even identical-raw tracks don't all show 100", () => {
  // Three distinct artists, one like each, same age → identical raw.
  const ranked = scoreLibrary(
    baseInput([mk("a", "x", 100), mk("b", "y", 100), mk("c", "z", 100)]),
  );
  expect(ranked.map((r) => r.score)).toEqual([100, 50, 0]);
});

test("display score is a percentile: top is 100, bottom is 0, monotonic", () => {
  const ranked = scoreLibrary(
    baseInput([mk("new", "a", 5), mk("mid", "b", 300), mk("old", "c", 900)]),
  );
  expect(ranked[0].score).toBe(100);
  expect(ranked[ranked.length - 1].score).toBe(0);
  const scores = ranked.map((r) => r.score);
  expect([...scores].sort((p, q) => q - p)).toEqual(scores); // non-increasing
});

test("a keep override (top track) lowers a track below an equal-age peer", () => {
  const ranked = scoreLibrary(
    baseInput([mk("keep", "a1", 400), mk("toss", "a2", 400)], {
      topTracksShort: ["keep"],
    }),
  );
  expect(ranked[0].saved.track.id).toBe("toss");
  expect(scoreOf(ranked, "keep")).toBeLessThan(scoreOf(ranked, "toss"));
});

test("artist affinity: an old track is rescued if you liked that artist recently", () => {
  // Same age (700d) for old_hot and old_cold; 'hot' also has a recent like.
  const ranked = scoreLibrary(
    baseInput([
      mk("old_hot", "hot", 700),
      mk("recent_hot", "hot", 10),
      mk("old_cold", "cold", 700),
    ]),
  );
  expect(scoreOf(ranked, "old_cold")).toBeGreaterThan(scoreOf(ranked, "old_hot"));
});

test("artist affinity: a solo like is more tossable than one from a prolific artist", () => {
  // 'prolific' has 6 likes all at 700d; 'thin' has 1 like at 700d (equal recency).
  const prolific = Array.from({ length: 6 }, (_, i) => mk(`p${i}`, "prolific", 700));
  const ranked = scoreLibrary(baseInput([...prolific, mk("thin", "thin", 700)]));
  expect(scoreOf(ranked, "thin")).toBeGreaterThan(scoreOf(ranked, "p0"));
});

test("weights change the ordering", () => {
  const input = baseInput([mk("plain", "a", 500), mk("fav", "favArtist", 800)], {
    topArtistsShort: ["favArtist"],
  });

  // No weight on the top-artist keep → the older track wins.
  const noKeep = scoreLibrary(input, {
    ...DEFAULT_CONFIG,
    weights: { ...DEFAULT_CONFIG.weights, topArtist: 0 },
  });
  expect(noKeep[0].saved.track.id).toBe("fav");

  // A strong top-artist keep pushes the favorite below the plain older track.
  const strongKeep = scoreLibrary(input, {
    ...DEFAULT_CONFIG,
    weights: { ...DEFAULT_CONFIG.weights, topArtist: 5 },
  });
  expect(strongKeep[0].saved.track.id).toBe("plain");
});

test("scored tracks expose a raw value and human reasons", () => {
  const ranked = scoreLibrary(baseInput([mk("old", "a", 900)]));
  expect(typeof ranked[0].raw).toBe("number");
  expect(ranked[0].reasons.length).toBeGreaterThan(0);
});
