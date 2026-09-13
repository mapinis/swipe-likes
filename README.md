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
the score is built from the signals that *are* available. **Toss pressure** comes
from signals that vary across your whole library:

- **Stale like** — how long ago you liked it (`added_at`).
- **Artist cold** — how long since you last liked *anything* by that artist
  (from your full library, not just the top-50).
- **Artist thin** — few liked songs by that artist ⇒ more likely clutter.

**Keep overrides** only *lower* the score (their absence is neutral, never extra
toss — this is what stops a diverse library from collapsing to a wall of 100s):

- **Top track / top artist** — still in your 4-week / 6-month / 1-year tops.
- **Recently played** — the track or artist is in your recent plays.

The displayed 0–100 is a **percentile across your library**, so the deck always
spans the full range and 100 means "most tossable *for you*." Weights and horizons
live in [`src/scoring/weights.ts`](src/scoring/weights.ts); the in-app **⚙ Scoring
tuner** lets you adjust them with a live raw-score histogram, and your choices are
saved. Each card shows the top reasons behind its score.

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

- **Drag, two-finger scroll, ←, or ✕** to toss; **→ / ♥** (or scroll/drag right)
  to keep; **↓ / ⤼** to skip; **↩ / Z** to undo.
- If scroll-to-swipe feels backwards (depends on your OS "natural scrolling"
  setting, which the browser can't detect), tick **Invert scroll** in the header
  — the choice is remembered.
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
