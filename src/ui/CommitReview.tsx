import { useState } from "react";
import type { ScoredTrack } from "../scoring/score.ts";
import { SWIPED_OUT_PLAYLIST_NAME } from "../config.ts";

export function CommitReview({
  items,
  onCancel,
  onConfirm,
}: {
  items: ScoredTrack[];
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    setStatus(`Backing up ${items.length} songs, then removing from Liked…`);
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-neutral-900 ring-1 ring-white/10 sm:rounded-3xl">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-xl font-semibold text-neutral-50">
            Toss {items.length} song{items.length === 1 ? "" : "s"}?
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            They'll be copied to your private{" "}
            <span className="font-medium text-neutral-200">
              "{SWIPED_OUT_PLAYLIST_NAME}"
            </span>{" "}
            playlist first, then removed from Liked Songs. You can re-like them
            anytime.
          </p>
        </div>

        <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
          {items.map((c) => (
            <li key={c.saved.track.id} className="flex items-center gap-3 p-3">
              <img
                src={c.saved.track.album.images[0]?.url}
                alt=""
                className="h-10 w-10 rounded bg-neutral-800 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-100">
                  {c.saved.track.name}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {c.saved.track.artists.map((a) => a.name).join(", ")}
                </p>
              </div>
              <span className="text-xs text-neutral-600">{c.score}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="border-t border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        {status && !error && (
          <p className="border-t border-white/10 p-3 text-sm text-emerald-300">
            {status}
          </p>
        )}

        <div className="flex gap-3 border-t border-white/10 p-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full bg-neutral-800 py-3 font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={confirm}
            disabled={busy || items.length === 0}
            className="flex-1 rounded-full bg-rose-600 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? "Working…" : "Toss them"}
          </button>
        </div>
      </div>
    </div>
  );
}
