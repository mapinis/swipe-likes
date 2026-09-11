import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import type { ScoredTrack } from "../scoring/score.ts";
import type { Decision } from "../deck/deck.ts";
import { Card } from "./Card.tsx";

const FLING_THRESHOLD = 110;

function DraggableCard({
  card,
  dir,
  onFling,
}: {
  card: ScoredTrack;
  dir: number;
  onFling: (decision: Decision) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const keepOpacity = useTransform(x, [20, 130], [0, 1]);
  const tossOpacity = useTransform(x, [-20, -130], [0, 1]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > FLING_THRESHOLD) onFling("keep");
    else if (info.offset.x < -FLING_THRESHOLD) onFling("toss");
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.96, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: dir * 700, opacity: 0, transition: { duration: 0.25 } }}
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
      <Card card={card} />
    </motion.div>
  );
}

export function SwipeDeck({
  current,
  upcoming,
  canUndo,
  onSwipe,
  onUndo,
}: {
  current: ScoredTrack;
  upcoming: ScoredTrack[];
  canUndo: boolean;
  onSwipe: (trackId: string, decision: Decision) => void;
  onUndo: () => void;
}) {
  const dirRef = useRef(0);
  const [, force] = useState(0);

  function fling(decision: Decision) {
    dirRef.current = decision === "keep" ? 1 : -1;
    force((n) => n + 1);
    onSwipe(current.saved.track.id, decision);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") fling("keep");
      else if (e.key === "ArrowLeft") fling("toss");
      else if (e.key.toLowerCase() === "z" && canUndo) onUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, canUndo]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <div className="relative aspect-[3/4.3] w-full">
        {upcoming.map((c, i) => (
          <div
            key={c.saved.track.id}
            className="absolute inset-0"
            style={{
              transform: `scale(${0.96 - i * 0.03}) translateY(${(i + 1) * 10}px)`,
              zIndex: -i - 1,
              opacity: 0.5,
            }}
          >
            <Card card={c} />
          </div>
        ))}
        <AnimatePresence initial={false}>
          <DraggableCard
            key={current.saved.track.id}
            card={current}
            dir={dirRef.current}
            onFling={fling}
          />
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => fling("toss")}
          aria-label="Toss"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-rose-500"
        >
          ✕
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-700 text-lg text-white shadow-lg transition hover:scale-105 enabled:hover:bg-neutral-600 disabled:opacity-40"
        >
          ↩
        </button>
        <button
          onClick={() => fling("keep")}
          aria-label="Keep"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-emerald-400"
        >
          ♥
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Swipe or use ← toss · → keep · Z undo
      </p>
    </div>
  );
}
