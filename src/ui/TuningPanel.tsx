import {
  DEFAULT_CONFIG,
  type ScoringConfig,
  type WeightName,
} from "../scoring/weights.ts";

const WEIGHT_FIELDS: { key: WeightName; label: string }[] = [
  { key: "age", label: "Age (stale like)" },
  { key: "artistCold", label: "Artist cold" },
  { key: "artistThin", label: "Artist thin" },
  { key: "topTrack", label: "Top track (keep)" },
  { key: "topArtist", label: "Top artist (keep)" },
  { key: "recentPlay", label: "Recently played (keep)" },
];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function Histogram({ raws }: { raws: number[] }) {
  if (raws.length === 0) {
    return <p className="text-xs text-neutral-500">No data yet.</p>;
  }
  const bins = 24;
  const min = Math.min(...raws);
  const max = Math.max(...raws);
  const span = max - min || 1;
  const counts = new Array(bins).fill(0);
  for (const r of raws) {
    const idx = Math.min(bins - 1, Math.floor(((r - min) / span) * bins));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);
  const med = median(raws);

  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]">
        {counts.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-emerald-500/70"
            style={{ height: `${(c / maxCount) * 100}%` }}
            title={`${c} songs`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        <span>low toss ({min.toFixed(2)})</span>
        <span>median {med.toFixed(2)}</span>
        <span>high toss ({max.toFixed(2)})</span>
      </div>
    </div>
  );
}

export function TuningPanel({
  config,
  raws,
  onChange,
  onReset,
  onClose,
}: {
  config: ScoringConfig;
  raws: number[];
  onChange: (c: ScoringConfig) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const setWeight = (key: WeightName, value: number) =>
    onChange({ ...config, weights: { ...config.weights, [key]: value } });
  const setHorizon = (key: keyof ScoringConfig["horizons"], value: number) =>
    onChange({ ...config, horizons: { ...config.horizons, [key]: value } });

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/60">
      <div className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-neutral-900 p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-50">Scoring tuner</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            Done
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Raw score distribution (pre-percentile)
          </p>
          <Histogram raws={raws} />
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Weights
          </p>
          {WEIGHT_FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <div className="flex justify-between text-sm text-neutral-300">
                <span>{label}</span>
                <span className="tabular-nums text-neutral-400">
                  {config.weights[key].toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={config.weights[key]}
                onChange={(e) => setWeight(key, Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Horizons
          </p>
          <label className="block">
            <div className="flex justify-between text-sm text-neutral-300">
              <span>Stale after</span>
              <span className="tabular-nums text-neutral-400">
                {config.horizons.ageDays}d
              </span>
            </div>
            <input
              type="range"
              min={90}
              max={1825}
              step={30}
              value={config.horizons.ageDays}
              onChange={(e) => setHorizon("ageDays", Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </label>
          <label className="block">
            <div className="flex justify-between text-sm text-neutral-300">
              <span>Artist cold after</span>
              <span className="tabular-nums text-neutral-400">
                {config.horizons.artistColdDays}d
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={730}
              step={15}
              value={config.horizons.artistColdDays}
              onChange={(e) =>
                setHorizon("artistColdDays", Number(e.target.value))
              }
              className="w-full accent-emerald-500"
            />
          </label>
        </div>

        <button
          onClick={onReset}
          className="mt-6 rounded-full bg-neutral-800 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
        >
          Reset to defaults
        </button>
        <p className="mt-3 text-[11px] text-neutral-600">
          Defaults: age {DEFAULT_CONFIG.weights.age}, artistCold{" "}
          {DEFAULT_CONFIG.weights.artistCold}, topArtist{" "}
          {DEFAULT_CONFIG.weights.topArtist}. Changes apply live and are saved.
        </p>
      </div>
    </div>
  );
}
