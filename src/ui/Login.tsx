import { SPOTIFY_CLIENT_ID } from "../config.ts";
import { beginLogin } from "../auth/session.ts";

export function Login({ onError }: { onError: (e: Error) => void }) {
  const configured = Boolean(SPOTIFY_CLIENT_ID);

  async function login() {
    try {
      await beginLogin();
    } catch (e) {
      onError(e as Error);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-neutral-50">Liked Songs Swiper</h1>
        <p className="mt-2 max-w-sm text-neutral-400">
          Swipe through your Spotify Liked Songs, toss the clutter, and keep a
          backup. The deck is sorted so the most likely-to-toss tracks come first.
        </p>
      </div>

      {configured ? (
        <button
          onClick={login}
          className="rounded-full bg-emerald-500 px-8 py-3 text-lg font-semibold text-neutral-950 shadow-lg transition hover:scale-105 hover:bg-emerald-400"
        >
          Connect Spotify
        </button>
      ) : (
        <div className="max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
          <p className="font-semibold">Missing Spotify Client ID</p>
          <p className="mt-1 text-amber-200/80">
            Copy <code className="rounded bg-black/30 px-1">.env.example</code> to{" "}
            <code className="rounded bg-black/30 px-1">.env.local</code> and set{" "}
            <code className="rounded bg-black/30 px-1">VITE_SPOTIFY_CLIENT_ID</code>,
            then restart the dev server. See the README for the one-time Spotify
            app setup.
          </p>
        </div>
      )}
    </div>
  );
}
