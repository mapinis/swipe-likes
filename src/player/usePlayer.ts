import { useCallback, useEffect, useRef, useState } from "react";
import { MOCK } from "../config.ts";
import { hasScope } from "../auth/session.ts";
import type { Track } from "../api/types.ts";
import { pausePlayback, playSnippet } from "./webPlayback.ts";

const SNIPPET_MS = 15_000;
const SNIPPET_START_FRACTION = 0.3;
const AUTOPLAY_DELAY_MS = 900;
const AUTOPLAY_KEY = "sp.autoplay";

function loadAutoPlay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function usePlayer(current: Track | null) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlayState] = useState<boolean>(loadAutoPlay);

  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsReconnect = !MOCK && !hasScope("streaming");

  const clearTimers = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    stopTimer.current = null;
    startTimer.current = null;
  };

  const stop = useCallback(() => {
    clearTimers();
    setPlayingId(null);
    setLoading(false);
    if (!MOCK) pausePlayback().catch(() => {});
  }, []);

  const play = useCallback(async (track: Track) => {
    clearTimers();
    setError(null);
    setLoading(true);
    setPlayingId(track.id);
    const positionMs = Math.floor((track.duration_ms ?? 0) * SNIPPET_START_FRACTION);
    try {
      if (!MOCK) await playSnippet(track.uri, positionMs);
      setLoading(false);
      stopTimer.current = setTimeout(() => stop(), SNIPPET_MS);
    } catch (e) {
      setLoading(false);
      setPlayingId(null);
      setError((e as Error).message);
    }
  }, [stop]);

  const toggle = useCallback(
    (track: Track) => {
      if (playingId === track.id) stop();
      else void play(track);
    },
    [playingId, play, stop],
  );

  const setAutoPlay = useCallback((on: boolean) => {
    setAutoPlayState(on);
    try {
      localStorage.setItem(AUTOPLAY_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  // Stop when the card changes; auto-start the new card if enabled.
  const currentId = current?.id ?? null;
  useEffect(() => {
    clearTimers();
    setPlayingId(null);
    setLoading(false);
    if (autoPlay && current && !needsReconnect) {
      startTimer.current = setTimeout(() => void play(current), AUTOPLAY_DELAY_MS);
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, autoPlay]);

  useEffect(() => clearTimers, []);

  return {
    playingId,
    loading,
    error,
    autoPlay,
    setAutoPlay,
    needsReconnect,
    toggle,
    stop,
  };
}
