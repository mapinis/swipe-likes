import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import type { ScoredTrack } from "../scoring/score.ts";
import type { Decision } from "../deck/deck.ts";
import { Card, type CardPlayback } from "./Card.tsx";

const FLING_THRESHOLD = 100;
const FLING_VELOCITY = 500;
const SCROLL_CLAMP = 240; // how far the card tracks a scroll gesture
const SCROLL_END_MS = 130; // idle gap that marks the end of a scroll gesture

export function SwipeDeck({
  current,
  upcoming,
  canUndo,
  onSwipe,
  onSkip,
  onUndo,
  playback,
  scrollInvert = false,
}: {
  current: ScoredTrack;
  upcoming: ScoredTrack[];
  canUndo: boolean;
  onSwipe: (trackId: string, decision: Decision) => void;
  onSkip: (trackId: string) => void;
  onUndo: () => void;
  playback?: CardPlayback;
  scrollInvert?: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const keepOpacity = useTransform(x, [30, 130], [0, 1]);
  const tossOpacity = useTransform(x, [-30, -130], [0, 1]);
  const [busy, setBusy] = useState(false);
  const cooldownUntil = useRef(0);

  const swipe = useCallback(
    async (decision: Decision) => {
      if (busy) return;
      setBusy(true);
      const dir = decision === "keep" ? 1 : -1;
      const distance = (typeof window !== "undefined" ? window.innerWidth : 600) * 1.15;
      await animate(x, dir * distance, { duration: 0.28, ease: "easeIn" }).finished;
      onSwipe(current.saved.track.id, decision);
      x.set(0); // reset for the incoming card before it paints
      // Absorb trackpad momentum so one gesture can't skip a second card.
      cooldownUntil.current = Date.now() + 300;
      setBusy(false);
    },
    [busy, current, onSwipe, x],
  );

  const skip = useCallback(() => {
    if (busy) return;
    onSkip(current.saved.track.id);
    x.set(0);
  }, [busy, current, onSkip, x]);

  // Two-finger horizontal scroll (trackpad) → swipe. A wheel gesture has no
  // "end" event, so commit after a short idle gap. preventDefault stops the
  // browser's back/forward swipe navigation.
  const cardAreaRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const el = cardAreaRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // ignore vertical
      e.preventDefault();
      if (busy || Date.now() < cooldownUntil.current) return;
      // Default follows the finger under macOS "natural scrolling" (the common
      // default). The invert toggle flips it for the other setting; JS can't
      // detect the OS preference, so it has to be user-selectable.
      const delta = e.deltaX * (scrollInvert ? -1 : 1);
      const next = Math.max(-SCROLL_CLAMP, Math.min(SCROLL_CLAMP, x.get() - delta));
      x.set(next);
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        const v = x.get();
        if (v > FLING_THRESHOLD) void swipe("keep");
        else if (v < -FLING_THRESHOLD) void swipe("toss");
        else animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      }, SCROLL_END_MS);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    };
  }, [busy, swipe, x, scrollInvert]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > FLING_THRESHOLD || info.velocity.x > FLING_VELOCITY) {
      void swipe("keep");
    } else if (info.offset.x < -FLING_THRESHOLD || info.velocity.x < -FLING_VELOCITY) {
      void swipe("toss");
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") void swipe("keep");
      else if (e.key === "ArrowLeft") void swipe("toss");
      else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") void skip();
      else if (e.key.toLowerCase() === "z" && canUndo) onUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe, skip, canUndo, onUndo]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 md:h-full md:max-w-none md:justify-center">
      <div
        ref={cardAreaRef}
        style={{ overscrollBehaviorX: "none" }}
        className="relative aspect-[3/4.3] w-full md:h-[70vh] md:max-h-[680px] md:w-auto"
      >
        {upcoming.map((c, i) => (
          <div
            key={c.saved.track.id}
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `scale(${0.96 - i * 0.03}) translateY(${(i + 1) * 12}px)`,
              zIndex: 0,
              opacity: 0.55,
            }}
          >
            <Card card={c} />
          </div>
        ))}

        <motion.div
          key={current.saved.track.id}
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          style={{ x, rotate }}
          drag={busy ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          onDragEnd={handleDragEnd}
          initial={{ scale: 0.94, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <motion.div
            style={{ opacity: keepOpacity }}
            className="pointer-events-none absolute left-5 top-5 z-10 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-extrabold text-emerald-400"
          >
            KEEP
          </motion.div>
          <motion.div
            style={{ opacity: tossOpacity }}
            className="pointer-events-none absolute right-5 top-5 z-10 rotate-12 rounded-lg border-4 border-rose-500 px-3 py-1 text-2xl font-extrabold text-rose-500"
          >
            TOSS
          </motion.div>
          <Card card={current} playback={playback} />
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void swipe("toss")}
          aria-label="Toss"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-rose-500"
        >
          ✕
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-700 text-lg text-white shadow-lg transition hover:scale-105 enabled:hover:bg-neutral-600 disabled:opacity-40"
        >
          ↩
        </button>
        <button
          onClick={() => void skip()}
          aria-label="Skip for now"
          title="Skip for now — see it again later"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-700 text-lg text-white shadow-lg transition hover:scale-105 hover:bg-neutral-600"
        >
          ⤼
        </button>
        <button
          onClick={() => void swipe("keep")}
          aria-label="Keep"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-emerald-400"
        >
          ♥
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Scroll or drag · ← toss · → keep · ↓ skip · Z undo
      </p>
    </div>
  );
}
