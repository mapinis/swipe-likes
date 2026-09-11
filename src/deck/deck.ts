import type { ScoredTrack } from "../scoring/score.ts";

export type Decision = "toss" | "keep";

export interface DeckState {
  decisions: Record<string, Decision>;
  undoStack: string[];
  committed: string[];
}

export const emptyDeck: DeckState = {
  decisions: {},
  undoStack: [],
  committed: [],
};

export function decide(
  state: DeckState,
  trackId: string,
  decision: Decision,
): DeckState {
  return {
    ...state,
    decisions: { ...state.decisions, [trackId]: decision },
    undoStack: [...state.undoStack, trackId],
  };
}

export function undo(state: DeckState): DeckState {
  if (state.undoStack.length === 0) return state;
  const undoStack = state.undoStack.slice(0, -1);
  const lastId = state.undoStack[state.undoStack.length - 1];
  const decisions = { ...state.decisions };
  delete decisions[lastId];
  return { ...state, decisions, undoStack };
}

export function canUndo(state: DeckState): boolean {
  return state.undoStack.length > 0;
}

export function tossedIds(state: DeckState): string[] {
  return Object.entries(state.decisions)
    .filter(([, d]) => d === "toss")
    .map(([id]) => id);
}

/** After a successful commit: move tossed → committed, clear them from staging. */
export function commitTossed(state: DeckState): DeckState {
  const tossed = tossedIds(state);
  const tossedSet = new Set(tossed);
  const decisions: Record<string, Decision> = {};
  for (const [id, d] of Object.entries(state.decisions)) {
    if (!tossedSet.has(id)) decisions[id] = d;
  }
  return {
    decisions,
    undoStack: state.undoStack.filter((id) => !tossedSet.has(id)),
    committed: [...state.committed, ...tossed],
  };
}

export function pendingDeck(
  scored: ScoredTrack[],
  state: DeckState,
): ScoredTrack[] {
  const committed = new Set(state.committed);
  return scored.filter(
    (s) => !committed.has(s.saved.track.id) && !(s.saved.track.id in state.decisions),
  );
}

export function currentCard(
  scored: ScoredTrack[],
  state: DeckState,
): ScoredTrack | null {
  return pendingDeck(scored, state)[0] ?? null;
}

export interface DeckCounts {
  remaining: number;
  tossed: number;
  kept: number;
  committed: number;
}

export function counts(scored: ScoredTrack[], state: DeckState): DeckCounts {
  let tossed = 0;
  let kept = 0;
  for (const d of Object.values(state.decisions)) {
    if (d === "toss") tossed++;
    else kept++;
  }
  return {
    remaining: pendingDeck(scored, state).length,
    tossed,
    kept,
    committed: state.committed.length,
  };
}
