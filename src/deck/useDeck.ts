import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScoredTrack } from "../scoring/score.ts";
import {
  canUndo,
  commitTossed,
  counts,
  currentCard,
  decide,
  emptyDeck,
  pendingDeck,
  skip,
  tossedIds,
  undo,
  type DeckState,
  type Decision,
  type UndoEntry,
} from "./deck.ts";

const STORE_KEY = "sp.deck";

function normalize(raw: unknown): DeckState {
  const r = (raw ?? {}) as Partial<DeckState> & { undoStack?: unknown };
  const undoStack: UndoEntry[] = Array.isArray(r.undoStack)
    ? r.undoStack.map((e) =>
        typeof e === "string"
          ? { id: e, kind: "decision" as const }
          : (e as UndoEntry),
      )
    : [];
  return {
    decisions: r.decisions ?? {},
    committed: r.committed ?? [],
    undoStack: undoStack.filter((e) => e.kind === "decision"),
    skipped: [], // session-only, never restored
  };
}

function loadDeckState(): DeckState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // ignore
  }
  return emptyDeck;
}

export function useDeck(scored: ScoredTrack[]) {
  const [state, setState] = useState<DeckState>(loadDeckState);

  useEffect(() => {
    try {
      // Persist decisions/committed only. Skips and their undo entries are
      // session-only so skipped cards reappear on the next reload.
      const persisted: DeckState = {
        decisions: state.decisions,
        committed: state.committed,
        undoStack: state.undoStack.filter((e) => e.kind === "decision"),
        skipped: [],
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(persisted));
    } catch {
      // ignore quota/private-mode failures
    }
  }, [state]);

  const swipe = useCallback(
    (trackId: string, decision: Decision) =>
      setState((s) => decide(s, trackId, decision)),
    [],
  );
  const skipCard = useCallback(
    (trackId: string) => setState((s) => skip(s, trackId)),
    [],
  );
  const undoLast = useCallback(() => setState((s) => undo(s)), []);
  const applyCommit = useCallback(() => setState((s) => commitTossed(s)), []);
  const reset = useCallback(() => setState(emptyDeck), []);

  const current = useMemo(() => currentCard(scored, state), [scored, state]);
  const upcoming = useMemo(
    () => pendingDeck(scored, state).slice(1, 4),
    [scored, state],
  );
  const deckCounts = useMemo(() => counts(scored, state), [scored, state]);
  const tossed = useMemo(() => tossedIds(state), [state]);

  return {
    state,
    current,
    upcoming,
    counts: deckCounts,
    tossedIds: tossed,
    canUndo: canUndo(state),
    swipe,
    skipCard,
    undoLast,
    applyCommit,
    reset,
  };
}
