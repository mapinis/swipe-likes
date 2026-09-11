import type { SavedTrack } from "../api/types.ts";
import { combineScore, scoreLibrary, type ScoringInput } from "./score.ts";

const NOW = Date.parse("2026-09-11T00:00:00Z");
const DAY = 86_400_000;

function saved(opts: {
  id: string;
  artistId: string;
  artistName?: string;
  ageDays: number;
}): SavedTrack {
  return {
    added_at: new Date(NOW - opts.ageDays * DAY).toISOString(),
    track: {
      id: opts.id,
      name: `Track ${opts.id}`,
      uri: `spotify:track:${opts.id}`,
      duration_ms: 200_000,
      artists: [{ id: opts.artistId, name: opts.artistName ?? opts.artistId }],
      album: { name: "Album", images: [] },
    },
  };
}

function emptyInput(overrides: Partial<ScoringInput>): ScoringInput {
  return {
    savedTracks: [],
    topTrackIds: { short: new Set(), medium: new Set(), long: new Set() },
    topArtistIds: { short: new Set(), medium: new Set(), long: new Set() },
    recentlyPlayedTrackIds: new Set(),
    recentlyPlayedArtistIds: new Set(),
    activeGenres: new Set(),
    artistGenres: new Map(),
    now: NOW,
    ...overrides,
  };
}

test("a current favorite scores near zero; a stale forgotten like scores high", () => {
  const fav = saved({ id: "fav", artistId: "aFav", ageDays: 10 });
  const stale = saved({ id: "old", artistId: "aOld", ageDays: 900 });

  const input = emptyInput({
    savedTracks: [fav, stale],
    topTrackIds: {
      short: new Set(["fav"]),
      medium: new Set(),
      long: new Set(),
    },
    topArtistIds: {
      short: new Set(["aFav"]),
      medium: new Set(),
      long: new Set(),
    },
    recentlyPlayedTrackIds: new Set(["fav"]),
    recentlyPlayedArtistIds: new Set(["aFav"]),
    activeGenres: new Set(["indie"]),
    artistGenres: new Map([
      ["aFav", ["indie"]],
      ["aOld", ["polka"]],
    ]),
  });

  const ranked = scoreLibrary(input);
  expect(ranked[0].saved.track.id).toBe("old");
  expect(ranked[0].score).toBeGreaterThan(80);
  expect(ranked[1].saved.track.id).toBe("fav");
  expect(ranked[1].score).toBeLessThan(10);
});

test("reasons explain a high toss score", () => {
  const stale = saved({
    id: "old",
    artistId: "aOld",
    artistName: "Polka Pete",
    ageDays: 900,
  });
  const input = emptyInput({
    savedTracks: [stale],
    activeGenres: new Set(["indie"]),
    artistGenres: new Map([["aOld", ["polka"]]]),
  });
  const [top] = scoreLibrary(input);
  expect(top.reasons.length).toBeGreaterThan(0);
  expect(top.reasons.join(" | ")).toMatch(/Liked 2y ago/);
  expect(top.reasons.join(" | ")).toMatch(/Polka Pete/);
});

test("recent like of the same artist rescues an old track from abandonment", () => {
  const oldTrack = saved({ id: "t1", artistId: "band", ageDays: 800 });
  const recentByBand = saved({ id: "t2", artistId: "band", ageDays: 5 });
  const input = emptyInput({ savedTracks: [oldTrack, recentByBand] });

  const ranked = scoreLibrary(input);
  const t1 = ranked.find((r) => r.saved.track.id === "t1")!;
  expect(t1.factors.artistAbandonment).toBeCloseTo(0.1);
});

test("combineScore renormalizes when genre data is unavailable", () => {
  // Only one factor present → its value drives the whole 0..100 score.
  expect(combineScore({ notRecentlyPlayed: 1 })).toBe(100);
  expect(combineScore({ notRecentlyPlayed: 0 })).toBe(0);
  // Two equal-weight-ish factors average toward the middle.
  const s = combineScore({ staleLike: 1, notTopTrack: 0 });
  expect(s).toBeGreaterThan(0);
  expect(s).toBeLessThan(100);
});

test("genreDrift is omitted when the artist has no genre data", () => {
  const s = saved({ id: "t", artistId: "a", ageDays: 100 });
  const input = emptyInput({ savedTracks: [s], activeGenres: new Set(["rock"]) });
  const [res] = scoreLibrary(input);
  expect(res.factors.genreDrift).toBeUndefined();
});
