import type { ScoredTrack } from "../scoring/score.ts";
import {
  commitTossed,
  counts,
  currentCard,
  decide,
  emptyDeck,
  rescue,
  skip,
  tossedIds,
  undo,
} from "./deck.ts";

function card(id: string, score: number): ScoredTrack {
  return {
    score,
    raw: score / 100,
    factors: {
      age: 0,
      artistCold: 0,
      artistThin: 0,
      topTrackKeep: 0,
      topArtistKeep: 0,
      recentKeep: 0,
    },
    reasons: [],
    saved: {
      added_at: "2020-01-01T00:00:00Z",
      track: {
        id,
        name: id,
        uri: `spotify:track:${id}`,
        duration_ms: 1,
        artists: [{ id: `a-${id}`, name: id }],
        album: { name: "", images: [] },
      },
    },
  };
}

const deck = [card("a", 90), card("b", 80), card("c", 70)];

test("current card is the highest-scored undecided track", () => {
  expect(currentCard(deck, emptyDeck)?.saved.track.id).toBe("a");
});

test("deciding advances the deck and records the decision", () => {
  let s = decide(emptyDeck, "a", "toss");
  expect(currentCard(deck, s)?.saved.track.id).toBe("b");
  s = decide(s, "b", "keep");
  expect(currentCard(deck, s)?.saved.track.id).toBe("c");
  expect(tossedIds(s)).toEqual(["a"]);
  expect(counts(deck, s)).toEqual({
    remaining: 1,
    tossed: 1,
    kept: 1,
    skipped: 0,
    committed: 0,
  });
});

test("rescue flips a tossed track to keep so it drops out of the toss pile", () => {
  let s = decide(emptyDeck, "a", "toss");
  s = decide(s, "b", "toss");
  expect(tossedIds(s)).toEqual(["a", "b"]);
  s = rescue(s, "a");
  expect(tossedIds(s)).toEqual(["b"]);
  expect(s.decisions.a).toBe("keep");
  // Rescuing something that isn't tossed is a no-op.
  expect(rescue(s, "c")).toBe(s);
});

test("skip hides the card without recording a decision; undo brings it back", () => {
  let s = skip(emptyDeck, "a");
  expect(currentCard(deck, s)?.saved.track.id).toBe("b");
  expect(s.decisions.a).toBeUndefined();
  expect(counts(deck, s)).toMatchObject({ skipped: 1, tossed: 0, kept: 0 });
  s = undo(s);
  expect(currentCard(deck, s)?.saved.track.id).toBe("a");
  expect(counts(deck, s)).toMatchObject({ skipped: 0 });
});

test("undo restores the previous card and clears its decision", () => {
  let s = decide(emptyDeck, "a", "toss");
  s = decide(s, "b", "keep");
  s = undo(s);
  expect(currentCard(deck, s)?.saved.track.id).toBe("b");
  expect(s.decisions.b).toBeUndefined();
  expect(s.decisions.a).toBe("toss");
});

test("commit moves tossed into committed and keeps the kept hidden", () => {
  let s = decide(emptyDeck, "a", "toss");
  s = decide(s, "b", "keep");
  s = commitTossed(s);
  expect(s.committed).toEqual(["a"]);
  expect(tossedIds(s)).toEqual([]);
  // 'a' removed (committed), 'b' kept/hidden → only 'c' remains pending.
  expect(currentCard(deck, s)?.saved.track.id).toBe("c");
  expect(counts(deck, s)).toMatchObject({ remaining: 1, committed: 1, kept: 1 });
});
