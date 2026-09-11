export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";

export const MOCK = import.meta.env.VITE_MOCK === "1";

export const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/callback`
    : "http://127.0.0.1:5173/callback";

// The Web Playback SDK requires streaming + user-read-email + user-read-private;
// play/pause via the Web API needs user-modify-playback-state. Missing any of
// these yields an "Invalid token scopes" error from the SDK.
export const PLAYBACK_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
];

export const SCOPES = [
  "user-library-read",
  "user-library-modify",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-modify-private",
  ...PLAYBACK_SCOPES,
];

export const SWIPED_OUT_PLAYLIST_NAME = "Swiped Out";
