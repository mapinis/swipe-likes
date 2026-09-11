import { REDIRECT_URI, SCOPES, SPOTIFY_CLIENT_ID } from "../config.ts";
import {
  buildAuthorizeUrl,
  codeChallenge,
  generateCodeVerifier,
  randomString,
} from "./pkce.ts";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const STORE_KEY = "sp.tokens";
const VERIFIER_KEY = "sp.pkce.verifier";
const STATE_KEY = "sp.pkce.state";
const REFRESH_BUFFER_MS = 60_000;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export function tokenIsFresh(
  expiresAt: number,
  now: number = Date.now(),
  buffer = REFRESH_BUFFER_MS,
): boolean {
  return expiresAt - now > buffer;
}

export function loadTokens(): TokenSet | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as TokenSet) : null;
  } catch {
    return null;
  }
}

function saveTokens(t: TokenSet): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(t));
}

export function clearTokens(): void {
  localStorage.removeItem(STORE_KEY);
}

export function isLoggedIn(): boolean {
  return loadTokens() !== null;
}

export function scopeStringHasAll(scope: string, required: string[]): boolean {
  const granted = new Set(scope.split(" ").filter(Boolean));
  return required.every((s) => granted.has(s));
}

export function hasScopes(required: string[]): boolean {
  const tokens = loadTokens();
  return tokens ? scopeStringHasAll(tokens.scope, required) : false;
}

function toTokenSet(res: TokenResponse, previous?: TokenSet | null): TokenSet {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? previous?.refreshToken ?? "",
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope ?? previous?.scope ?? "",
  };
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function beginLogin(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error(
      "Missing VITE_SPOTIFY_CLIENT_ID. Copy .env.example to .env.local and set it.",
    );
  }
  const verifier = generateCodeVerifier();
  const state = randomString(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const challenge = await codeChallenge(verifier);
  window.location.assign(
    buildAuthorizeUrl({
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
      state,
      challenge,
    }),
  );
}

export async function handleRedirectCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) throw new Error(`Spotify authorization failed: ${error}`);

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  if (!code || !state) throw new Error("Missing authorization code in callback.");
  if (!expectedState || state !== expectedState)
    throw new Error("State mismatch — possible CSRF. Try logging in again.");
  if (!verifier) throw new Error("Missing PKCE verifier — restart login.");

  const res = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  saveTokens(toTokenSet(res));
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

let refreshInFlight: Promise<string> | null = null;

async function refreshTokens(current: TokenSet): Promise<string> {
  const res = await postToken({
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });
  const next = toTokenSet(res, current);
  saveTokens(next);
  return next.accessToken;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new Error("Not logged in.");
  if (tokenIsFresh(tokens.expiresAt)) return tokens.accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshTokens(tokens).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export function logout(): void {
  clearTokens();
}
