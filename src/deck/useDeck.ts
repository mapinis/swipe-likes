import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScoredTrack } from "../scoring/score.ts";
import {
  canUndo,
  commitTossed,
  decide,
  emptyDeck,
  pendingDeck,
  rescue,
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
  const rescueToss = useCallback(
    (trackId: string) => setState((s) => rescue(s, trackId)),
    [],
  );
  const applyCommit = useCallback(() => setState((s) => commitTossed(s)), []);
  const reset = useCallback(() => setState(emptyDeck), []);

  // Filter the pending deck once per change; derive everything else from it
  // (avoids re-scanning the whole library several times on each swipe).
  const pending = useMemo(() => pendingDeck(scored, state), [scored, state]);
  const current = pending[0] ?? null;
  const upcoming = useMemo(() => pending.slice(1, 4), [pending]);
  const deckCounts = useMemo(() => {
    let tossedCount = 0;
    let kept = 0;
    for (const d of Object.values(state.decisions)) {
      if (d === "toss") tossedCount++;
      else kept++;
    }
    return {
      remaining: pending.length,
      tossed: tossedCount,
      kept,
      skipped: state.skipped.length,
      committed: state.committed.length,
    };
  }, [pending, state]);
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
    rescueToss,
    applyCommit,
    reset,
  };
}
