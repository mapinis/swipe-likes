import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
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
const SCROLL_END_MS = 130; // idle gap that snaps a below-threshold scroll back
const SCROLL_REST_MS = 160; // idle gap that ends the momentum tail after a commit

interface MomentumLock {
  locked: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface SwipeCardHandle {
  swipe: (decision: Decision) => void;
}

// One card instance per track (keyed by id), each with its OWN x motion value.
// A fresh instance mounts centered; the outgoing instance keeps its flung-out
// position and simply unmounts — so nothing ever snaps back into view.
const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    card: ScoredTrack;
    playback?: CardPlayback;
    scrollInvert: boolean;
    momentum: { current: MomentumLock };
    onDecision: (decision: Decision) => void;
  }
>(function SwipeCard({ card, playback, scrollInvert, momentum, onDecision }, ref) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const keepOpacity = useTransform(x, [30, 130], [0, 1]);
  const tossOpacity = useTransform(x, [-30, -130], [0, 1]);
  const leaving = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fly = useCallback(
    (decision: Decision) => {
      if (leaving.current) return;
      leaving.current = true;
      const dir = decision === "keep" ? 1 : -1;
      const distance = (typeof window !== "undefined" ? window.innerWidth : 600) * 1.15;
      void animate(x, dir * distance, { duration: 0.28, ease: "easeIn" }).finished.then(
        () => onDecision(decision),
      );
    },
    [onDecision, x],
  );

  useImperativeHandle(ref, () => ({ swipe: fly }), [fly]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (leaving.current) return;
    if (info.offset.x > FLING_THRESHOLD || info.velocity.x > FLING_VELOCITY) fly("keep");
    else if (info.offset.x < -FLING_THRESHOLD || info.velocity.x < -FLING_VELOCITY)
      fly("toss");
    else animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
  }

  // Two-finger horizontal scroll (trackpad) → swipe. Commit the instant the
  // scroll passes the threshold; trackpad inertia keeps firing wheel events for
  // ~1-2s after you lift your fingers, so a momentum lock (shared across card
  // instances) absorbs that tail until the scroll actually pauses.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const hold = () => {
      momentum.current.locked = true;
      if (momentum.current.timer) clearTimeout(momentum.current.timer);
      momentum.current.timer = setTimeout(() => {
        momentum.current.locked = false;
      }, SCROLL_REST_MS);
    };
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // ignore vertical
      e.preventDefault(); // stop the browser's back/forward swipe navigation
      if (leaving.current || momentum.current.locked) {
        hold();
        return;
      }
      // Default follows the finger under macOS "natural scrolling"; the invert
      // toggle flips it, since JS can't read the OS preference.
      const delta = e.deltaX * (scrollInvert ? -1 : 1);
      const next = Math.max(-SCROLL_CLAMP, Math.min(SCROLL_CLAMP, x.get() - delta));
      x.set(next);

      if (next >= FLING_THRESHOLD || next <= -FLING_THRESHOLD) {
        if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
        hold();
        fly(next > 0 ? "keep" : "toss");
        return;
      }
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      }, SCROLL_END_MS);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    };
  }, [fly, x, scrollInvert, momentum]);

  return (
    <motion.div
      ref={rootRef}
      className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      // Grow into place from the top-of-stack position when promoted to current.
      // Safe now that the stack has correct z-order (this card is z-10, on top).
      initial={{ scale: 0.96, y: 12 }}
      animate={{ scale: 1, y: 0 }}
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
      <Card card={card} playback={playback} />
    </motion.div>
  );
});

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
  const cardRef = useRef<SwipeCardHandle>(null);
  const momentum = useRef<MomentumLock>({ locked: false, timer: null });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") cardRef.current?.swipe("keep");
      else if (e.key === "ArrowLeft") cardRef.current?.swipe("toss");
      else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s")
        onSkip(current.saved.track.id);
      else if (e.key.toLowerCase() === "z" && canUndo) onUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, canUndo, onSkip, onUndo]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 md:h-full md:max-w-none md:justify-center">
      <div
        style={{ overscrollBehaviorX: "none" }}
        className="relative aspect-[3/4.3] w-full md:h-[70vh] md:max-h-[680px] md:w-auto"
      >
        {upcoming.map((c, i) => (
          <div
            key={c.saved.track.id}
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `scale(${0.96 - i * 0.03}) translateY(${(i + 1) * 12}px)`,
              // Opaque so the top-of-stack card never shows the cards behind it
              // through itself during a swipe; a slight dim gives depth instead.
              filter: `brightness(${0.85 - i * 0.1})`,
              transition: "transform 0.25s ease, filter 0.25s ease",
              // Descending z so the NEXT card sits on top of the stack (and the
              // current card, z-10, stays above all). Equal z made the farthest
              // card paint on top, which showed through during the fly-out.
              zIndex: 9 - i,
            }}
          >
            <Card card={c} />
          </div>
        ))}

        <SwipeCard
          ref={cardRef}
          key={current.saved.track.id}
          card={current}
          playback={playback}
          scrollInvert={scrollInvert}
          momentum={momentum}
          onDecision={(d) => onSwipe(current.saved.track.id, d)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => cardRef.current?.swipe("toss")}
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
          onClick={() => onSkip(current.saved.track.id)}
          aria-label="Skip for now"
          title="Skip for now — see it again later"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-700 text-4xl text-white shadow-lg transition hover:scale-105 hover:bg-neutral-600"
        >
          ⤼
        </button>
        <button
          onClick={() => cardRef.current?.swipe("keep")}
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
