# Liked Songs Swiper

A Tinder-style web app for decluttering your Spotify **Liked Songs**. It sorts
your library by a "toss score" so the songs you're most likely done with come
first, then you swipe to keep or toss. Tossed songs are backed up to a private
**"Swiped Out"** playlist before being removed from Liked Songs, so nothing is
truly lost.

It runs entirely in your browser — no backend, no server, no secrets. Auth uses
Spotify's Authorization Code + PKCE flow.

## How the toss score works

Spotify's API no longer exposes audio/mood features or per-track play counts, so
the score is built from the signals that *are* available:

- **Stale like** — how long ago you liked it (`added_at`).
- **Not a top track** — absent from your top tracks (4 weeks / 6 months / 1 year).
- **Artist not in your top artists** — you've drifted from the artist.
- **Not played recently** — missing from your recently-played history.
- **Genre drift** — the artist's genres are outside your current active genres.
- **Artist abandonment** — few/old likes from this artist in your library.

Weights live in [`src/scoring/weights.ts`](src/scoring/weights.ts) and are easy
to tune. Each card shows the top reasons behind its score.

## One-time Spotify setup

You need a **Spotify Premium** account (a 2026 API requirement for personal apps).

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and **Create app**.
2. Set the **Redirect URI** to exactly:
   ```
   http://127.0.0.1:5173/callback
   ```
3. Select the **Web API** when asked which APIs you'll use.
4. Open the app's **Settings → User Management** and add the Spotify account's
   email (development-mode apps only work for allow-listed users — just you).
5. Copy the app's **Client ID**.

Then configure the project:

```bash
cp .env.example .env.local
# edit .env.local and set VITE_SPOTIFY_CLIENT_ID=<your client id>
```

## Run it

```bash
nvm use          # Node 22 (see .nvmrc)
npm install
npm run dev
```

Open http://127.0.0.1:5173 and click **Connect Spotify**.

### Try it without Spotify (demo mode)

```bash
VITE_MOCK=1 npm run dev
```

Loads a sample library so you can see the deck, swiping, undo, and the commit
review without connecting an account.

## Using it

- **Swipe / ← / ✕** to toss, **swipe / → / ♥** to keep, **↓ / ⤼** to skip,
  **↩ / Z** to undo.
- **Keep** and **toss** are remembered locally (they survive a reload).
  **Skip** is "see it again later" — it hides the card for now but the song
  comes back the next time you reload or refresh.
- Nothing changes on Spotify until you hit **Review** and confirm. On confirm,
  tossed songs are copied to your private **"Swiped Out"** playlist, then removed
  from Liked Songs. Re-like them anytime if you change your mind.
- **▶ Preview** plays ~15 seconds from ~30% into the track (the "hook"). Tick
  **Auto-play preview** to start the snippet automatically whenever a new card
  appears. Preview needs the Web Playback SDK scopes — if you connected before
  this feature existed, click **Reconnect to enable previews** once. Preview
  needs a Chrome/Edge/Firefox browser (Safari can't stream via the SDK).
- **⟳** refetches your library and re-scores. **⎋** logs out.

## Scripts

```bash
npm run dev        # dev server (http://127.0.0.1:5173)
npm test           # unit tests (scoring, auth, API client, deck)
npm run typecheck  # type-check only
npm run build      # production build to dist/
```

## Notes & limitations

- **Development mode**: the app is limited to allow-listed users and can't be
  shared publicly — fine for personal use.
- **Previews** stream via the Web Playback SDK (full track, ~15s snippet), which
  needs Premium and a Chrome/Edge/Firefox browser. The old 30s `preview_url`
  clips were deprecated, so there's no lightweight fallback in other browsers.
- **API currency**: uses the post-Feb-2026 write endpoints (`POST /me/playlists`,
  `POST /playlists/{id}/items`, `DELETE /me/library`); the pre-2026 equivalents
  now return 403 for development-mode apps.
- **Genres are best-effort**: if the artist-genre endpoint is unavailable for
  your app, the genre-drift factor is simply skipped and the other factors are
  re-weighted.
- Your data is cached locally (IndexedDB) and your tokens in `localStorage`;
  nothing leaves your browser except calls to Spotify.
