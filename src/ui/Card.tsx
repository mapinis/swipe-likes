import type { ScoredTrack } from "../scoring/score.ts";

function scoreColor(score: number): string {
  const hue = Math.round(140 - 1.4 * score); // 140=green → 0=red
  return `hsl(${hue}, 68%, 45%)`;
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Toss bait";
  if (score >= 50) return "Probably clutter";
  if (score >= 25) return "On the fence";
  return "You love this";
}

export function Card({ card }: { card: ScoredTrack }) {
  const t = card.saved.track;
  const art = t.album.images[0]?.url;
  const artists = t.artists.map((a) => a.name).join(", ");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl ring-1 ring-white/10">
      <div className="relative aspect-square w-full bg-neutral-800">
        {art ? (
          <img
            src={art}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-900 text-5xl">
            🎵
          </div>
        )}
        <div
          className="absolute right-3 top-3 flex flex-col items-center rounded-2xl px-3 py-2 text-white shadow-lg"
          style={{ backgroundColor: scoreColor(card.score) }}
        >
          <span className="text-2xl font-bold leading-none">{card.score}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-90">
            toss score
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h2 className="truncate text-xl font-semibold text-neutral-50">
            {t.name}
          </h2>
          <p className="truncate text-neutral-400">{artists}</p>
        </div>

        <p className="text-sm font-medium" style={{ color: scoreColor(card.score) }}>
          {scoreLabel(card.score)}
        </p>

        <div className="mt-auto flex flex-wrap gap-2">
          {card.reasons.length > 0 ? (
            card.reasons.map((r) => (
              <span
                key={r}
                className="rounded-full bg-white/5 px-3 py-1 text-xs text-neutral-300 ring-1 ring-white/10"
              >
                {r}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-neutral-300 ring-1 ring-white/10">
              Still in rotation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
