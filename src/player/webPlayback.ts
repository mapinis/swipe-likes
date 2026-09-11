import { getValidAccessToken } from "../auth/session.ts";
import { client } from "../data/source.ts";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME = "Liked Songs Swiper";

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  addListener(event: string, cb: (arg: unknown) => void): boolean;
}

interface SpotifyNamespace {
  Player: new (opts: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function loadSdk(): Promise<SpotifyNamespace> {
  return new Promise((resolve, reject) => {
    if (window.Spotify) return resolve(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify) resolve(window.Spotify);
      else reject(new Error("Spotify SDK loaded but unavailable"));
    };
    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
      document.head.appendChild(script);
    }
  });
}

let deviceReady: Promise<string> | null = null;

function initDevice(): Promise<string> {
  if (deviceReady) return deviceReady;
  deviceReady = (async () => {
    const Spotify = await loadSdk();
    const player = new Spotify.Player({
      name: PLAYER_NAME,
      getOAuthToken: (cb) => {
        getValidAccessToken().then(cb).catch(() => cb(""));
      },
      volume: 0.6,
    });

    return await new Promise<string>((resolve, reject) => {
      player.addListener("ready", (arg) => {
        resolve((arg as { device_id: string }).device_id);
      });
      const fail = (arg: unknown) =>
        reject(new Error((arg as { message?: string })?.message ?? "Playback error"));
      player.addListener("initialization_error", fail);
      player.addListener("authentication_error", fail);
      player.addListener("account_error", fail);
      player.connect().then((ok) => {
        if (!ok) reject(new Error("Spotify player failed to connect"));
      });
    });
  })().catch((e) => {
    deviceReady = null; // allow retry
    throw e;
  });
  return deviceReady;
}

export async function playSnippet(uri: string, positionMs: number): Promise<void> {
  const deviceId = await initDevice();
  await client.request("/me/player/play", {
    method: "PUT",
    query: { device_id: deviceId },
    body: { uris: [uri], position_ms: Math.max(0, Math.floor(positionMs)) },
  });
}

export async function pausePlayback(): Promise<void> {
  if (!deviceReady) return;
  const deviceId = await deviceReady;
  await client.request("/me/player/pause", {
    method: "PUT",
    query: { device_id: deviceId },
  });
}
