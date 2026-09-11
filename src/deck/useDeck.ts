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
  tossedIds,
  undo,
  type DeckState,
  type Decision,
} from "./deck.ts";

const STORE_KEY = "sp.deck";

function loadDeckState(): DeckState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DeckState;
  } catch {
    // ignore
  }
  return emptyDeck;
}

export function useDeck(scored: ScoredTrack[]) {
  const [state, setState] = useState<DeckState>(loadDeckState);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota/private-mode failures
    }
  }, [state]);

  const swipe = useCallback(
    (trackId: string, decision: Decision) =>
      setState((s) => decide(s, trackId, decision)),
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
    undoLast,
    applyCommit,
    reset,
  };
}
