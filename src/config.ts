export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";

export const MOCK = import.meta.env.VITE_MOCK === "1";

export const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/callback`
    : "http://127.0.0.1:5173/callback";

export const SCOPES = [
  "user-library-read",
  "user-library-modify",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "playlist-modify-private",
];

export const SWIPED_OUT_PLAYLIST_NAME = "Swiped Out";
