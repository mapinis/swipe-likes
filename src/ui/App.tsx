import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MOCK } from "../config.ts";
import {
  beginLogin,
  handleRedirectCallback,
  isLoggedIn,
  logout,
} from "../auth/session.ts";
import { client, getSnapshot } from "../data/source.ts";
import { toScoringInput, type Snapshot } from "../data/cache.ts";
import { scoreLibrary } from "../scoring/score.ts";
import { DEFAULT_CONFIG, type ScoringConfig } from "../scoring/weights.ts";
import { commitToss } from "../deck/commit.ts";
import { useDeck } from "../deck/useDeck.ts";
import { usePlayer } from "../player/usePlayer.ts";
import { SwipeDeck } from "./SwipeDeck.tsx";
import { CommitReview } from "./CommitReview.tsx";
import { TuningPanel } from "./TuningPanel.tsx";
import { Login } from "./Login.tsx";

const CONFIG_KEY = "sp.scoreConfig";

function loadConfig(): ScoringConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScoringConfig;
      return {
        weights: { ...DEFAULT_CONFIG.weights, ...parsed.weights },
        horizons: { ...DEFAULT_CONFIG.horizons, ...parsed.horizons },
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

type Phase = "init" | "login" | "loading" | "error" | "ready";

export function App() {
  const [phase, setPhase] = useState<Phase>("init");
  const [loadingMsg, setLoadingMsg] = useState("Loading…");
  const [errorMsg, setErrorMsg] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [config, setConfig] = useState<ScoringConfig>(loadConfig);

  const updateConfig = useCallback((c: ScoringConfig) => {
    setConfig(c);
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    } catch {
      // ignore
    }
  }, []);

  const scored = useMemo(
    () => (snapshot ? scoreLibrary(toScoringInput(snapshot), config) : []),
    [snapshot, config],
  );

  const loadData = useCallback(async (force = false) => {
    setPhase("loading");
    setLoadingMsg(force ? "Refreshing your library…" : "Loading your library…");
    try {
      const snap = await getSnapshot({
        force,
        onProgress: (p) =>
          setLoadingMsg(
            p.total
              ? `${p.phase}… ${p.collected}/${p.total}`
              : p.collected
                ? `${p.phase}… ${p.collected}`
                : `${p.phase}…`,
          ),
      });
      setSnapshot(snap);
      setPhase("ready");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    // Detect the OAuth redirect by its query params rather than a fixed path, so
    // it works both locally (/callback) and on GitHub Pages (bounced to the base
    // by 404.html). Clean the URL back to the app root afterward.
    const params = new URLSearchParams(window.location.search);
    const home = import.meta.env.BASE_URL;
    if (!MOCK && (params.has("code") || params.has("error"))) {
      setPhase("loading");
      setLoadingMsg("Finishing sign-in…");
      handleRedirectCallback()
        .then(() => {
          window.history.replaceState({}, "", home);
          return loadData();
        })
        .catch((e) => {
          // Clear the (now-used) code from the URL so a reload can't re-exchange it.
          window.history.replaceState({}, "", home);
          setErrorMsg((e as Error).message);
          setPhase("error");
        });
    } else if (MOCK || isLoggedIn()) {
      loadData();
    } else {
      setPhase("login");
    }
  }, [loadData]);

  const deck = useDeck(scored);
  const currentTrack = deck.current?.saved.track ?? null;
  const player = usePlayer(currentTrack);

  const [scrollInvert, setScrollInvert] = useState(() => {
    try {
      return localStorage.getItem("sp.scrollInvert") === "1";
    } catch {
      return false;
    }
  });
  const updateScrollInvert = useCallback((on: boolean) => {
    setScrollInvert(on);
    try {
      localStorage.setItem("sp.scrollInvert", on ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const playback = useMemo(() => {
    if (!currentTrack) return undefined;
    return {
      isPlaying: player.playingId === currentTrack.id,
      isLoading: player.loading && player.playingId === currentTrack.id,
      onToggle: () =>
        player.needsReconnect
          ? void beginLogin().catch(() => {})
          : player.toggle(currentTrack),
    };
  }, [currentTrack, player]);

  // Only materialize the tossed list when the review sheet is open — no need to
  // scan the library on every swipe.
  const tossedCards = useMemo(() => {
    if (!reviewing) return [];
    const ids = new Set(deck.tossedIds);
    return scored.filter((s) => ids.has(s.saved.track.id));
  }, [reviewing, scored, deck.tossedIds]);

  const handleConfirmCommit = useCallback(async () => {
    if (!snapshot) return;
    if (!MOCK) {
      await commitToss(
        client,
        snapshot.user.id,
        tossedCards.map((c) => ({
          id: c.saved.track.id,
          uri: c.saved.track.uri,
        })),
      );
    }
    deck.applyCommit();
    setReviewing(false);
  }, [snapshot, tossedCards, deck]);

  function onLogout() {
    logout();
    deck.reset();
    setSnapshot(null);
    setPhase("login");
  }

  if (phase === "init" || phase === "loading") {
    return <Centered>{<Spinner label={loadingMsg} />}</Centered>;
  }
  if (phase === "login") {
    return (
      <Shell>
        <Login onError={(e) => { setErrorMsg(e.message); setPhase("error"); }} />
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-rose-400">Something went wrong</p>
          <p className="mt-2 break-words text-sm text-neutral-400">{errorMsg}</p>
          <button
            onClick={() =>
              isLoggedIn() ? loadData() : void beginLogin().catch(() => {})
            }
            className="mt-5 rounded-full bg-emerald-500 px-5 py-2 font-semibold text-neutral-950 hover:bg-emerald-400"
          >
            {isLoggedIn() ? "Try again" : "Connect Spotify"}
          </button>
        </div>
      </Centered>
    );
  }

  const { counts, current } = deck;

  return (
    <Shell>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-100">
            {snapshot?.user.display_name ?? "You"}
            {MOCK && <span className="ml-2 text-xs text-amber-400">demo</span>}
          </p>
          <p className="text-xs text-neutral-500">
            {counts.remaining} left · {counts.tossed} tossed
            {counts.skipped > 0 && ` · ${counts.skipped} skipped`} · {counts.committed} removed
          </p>
        </div>
        <div className="hidden items-center gap-4 text-xs md:flex">
          <PlaybackControls
            player={player}
            scrollInvert={scrollInvert}
            onScrollInvert={updateScrollInvert}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReviewing(true)}
            disabled={counts.tossed === 0}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-rose-500 disabled:opacity-40"
          >
            Review {counts.tossed > 0 ? counts.tossed : ""} ⟶
          </button>
          <button
            onClick={() => setTuning(true)}
            title="Scoring tuner"
            className="rounded-full bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            ⚙
          </button>
          <button
            onClick={() => loadData(true)}
            title="Refresh data"
            className="rounded-full bg-neutral-800 px-3 py-1 text-xl text-neutral-300 hover:bg-neutral-700"
          >
            ⟳
          </button>
          <button
            onClick={onLogout}
            className="rounded-full bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            ⎋
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2 text-xs md:hidden">
        <PlaybackControls
          player={player}
          scrollInvert={scrollInvert}
          onScrollInvert={updateScrollInvert}
        />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-6 md:py-10">
        {current ? (
          <SwipeDeck
            current={current}
            upcoming={deck.upcoming}
            canUndo={deck.canUndo}
            onSwipe={deck.swipe}
            onSkip={deck.skipCard}
            onUndo={deck.undoLast}
            playback={playback}
            scrollInvert={scrollInvert}
          />
        ) : (
          <div className="max-w-sm text-center">
            <p className="text-5xl">🎉</p>
            <p className="mt-4 text-xl font-semibold text-neutral-100">
              {counts.tossed > 0 ? "Ready to clean up" : "Deck cleared!"}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {counts.tossed > 0
                ? `You've queued ${counts.tossed} song${counts.tossed === 1 ? "" : "s"} to toss.`
                : "No more songs to review right now."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {counts.tossed > 0 && (
                <button
                  onClick={() => setReviewing(true)}
                  className="rounded-full bg-rose-600 px-5 py-2 font-semibold text-white hover:bg-rose-500"
                >
                  Review {counts.tossed} tosses
                </button>
              )}
              <button
                onClick={() => loadData(true)}
                className="rounded-full bg-neutral-700 px-5 py-2 text-neutral-100 hover:bg-neutral-600"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </main>

      {reviewing && (
        <CommitReview
          items={tossedCards}
          onCancel={() => setReviewing(false)}
          onConfirm={handleConfirmCommit}
          onRescue={deck.rescueToss}
        />
      )}

      {tuning && (
        <TuningPanel
          config={config}
          raws={scored.map((s) => s.raw)}
          onChange={updateConfig}
          onReset={() => updateConfig(DEFAULT_CONFIG)}
          onClose={() => setTuning(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col bg-neutral-950 text-neutral-100 md:max-w-none">
      {children}
    </div>
  );
}

function PlaybackControls({
  player,
  scrollInvert,
  onScrollInvert,
}: {
  player: ReturnType<typeof usePlayer>;
  scrollInvert: boolean;
  onScrollInvert: (on: boolean) => void;
}) {
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 text-neutral-300">
        <input
          type="checkbox"
          checked={player.autoPlay}
          onChange={(e) => player.setAutoPlay(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Auto-play preview
      </label>
      {/* Only relevant to trackpad wheel-scrolling, i.e. desktop. */}
      <label className="hidden cursor-pointer items-center gap-2 text-neutral-300 md:flex">
        <input
          type="checkbox"
          checked={scrollInvert}
          onChange={(e) => onScrollInvert(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Invert scroll
      </label>
      {player.needsReconnect ? (
        <button
          onClick={() => void beginLogin().catch(() => {})}
          className="text-amber-400 underline decoration-dotted"
        >
          Reconnect to enable previews
        </button>
      ) : player.error ? (
        <span className="truncate text-rose-400">{player.error}</span>
      ) : (
        <span className="hidden text-neutral-600 lg:inline">
          plays ~15s from the hook
        </span>
      )}
    </>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-neutral-950 text-neutral-100">
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-700 border-t-emerald-500" />
      <p className="text-sm text-neutral-400">{label}</p>
    </div>
  );
}
