# SuiteRhythm — Next.js Migration Notes

## What Was Moved

| Original file/folder | New location | Change |
|---|---|---|
| `index.html` | `components/AppShell.jsx` + `components/sections/` + `components/modals/` | Converted HTML to JSX, split into React components |
| `game.js` | `engine/SuiteRhythm.js` | Updated import paths; exports class instead of auto-initializing |
| `api.js` | `lib/api.js` | Fixed relative URL `saved-sounds.json` → `/saved-sounds.json` |
| `config.js` | `lib/config.js` | No changes needed |
| `integration.js` | `lib/integration.js` | No changes needed (paths were already relative) |
| `modules/*.js` | `lib/modules/*.js` | No changes needed (paths were already relative) |
| `styles.css` | `app/globals.css` | Copied as-is |
| `saved-sounds.json` | `public/saved-sounds.json` | Served as a static asset |
| `stories.json` | `public/stories.json` | Served as a static asset |
| `manifest.json` | `public/manifest.json` | Served as a static asset |
| `service-worker.js` | `public/service-worker.js` | Served as a static asset |
| `robots.txt` | `public/robots.txt` | Served as a static asset |
| `server/index.js` | `app/api/sounds/route.js`, `app/api/analyze/route.js`, `app/api/health/route.js` | Converted Express routes to Next.js App Router handlers |

---

## What Was Changed

### Architecture

**Engine initialization**: `game.js` previously auto-initialized via `DOMContentLoaded`. In Next.js, the `SuiteRhythm` class is exported and instantiated inside a `useEffect` in `AppShell.jsx` after the React component has mounted. This preserves the same timing (DOM is ready before the engine runs).

**Dynamic import with `ssr: false`**: `AppShell` is loaded via `next/dynamic` with `ssr: false` on the dashboard page. This prevents the audio engine (which uses `window.AudioContext`, `SpeechRecognition`, `localStorage`, `Howler`) from executing on the server during SSR.

**Howler.js**: Was loaded from CDN (`<script src="howler.min.js">`). Now installed as an npm package (`howler@2.2.4`) and imported at the top of `engine/SuiteRhythm.js` via `import { Howl } from 'howler'`.

**CSS**: All styles moved to `app/globals.css` and automatically applied globally by the root layout. No CSS Modules were introduced — the existing class-based system works fine as-is.

**API routing**: The frontend now points to `/api/*` routes (Next.js handlers) instead of the external Render backend directly. The `/api/analyze` route currently proxies to the Render backend. This proxy can be removed once the AI logic is moved server-side.

**Module resolution**: All JS modules now use relative paths correctly:
- `lib/modules/*.js` import `from '../config.js'` → resolves to `lib/config.js` ✓
- `lib/integration.js` imports `from './config.js'` → resolves to `lib/config.js` ✓
- `engine/SuiteRhythm.js` imports updated from `./config.js` → `../lib/config.js` ✓

### React component decisions

The UI was split into React components for code organization, but **the SuiteRhythm engine still manages all UI state via direct DOM manipulation**. React components render the HTML scaffold; the engine wires up all event listeners and mutations via `getElementById` / `classList` / `innerHTML`. This is intentional — the engine is 7,000+ lines of tightly coupled DOM code that cannot be safely "React-ified" in a single migration without a full rewrite.

All sections are **always rendered** in the DOM (hidden via the CSS `hidden` class), matching the original HTML behavior. The engine shows/hides sections by toggling that class.

---

## What Still Needs Backend Work

### 1. Auth (TODO)
- The Subscribe modal and token input exist in the UI but there is no Next.js auth layer.
- **Next step**: Add NextAuth.js or Clerk. Check session in `app/dashboard/page.jsx` and redirect unauthenticated users to a landing page.

### 2. Stripe subscription (TODO)
- The "Subscribe $10/month" button exists but has no Stripe integration server-side.
- **Next step**: Create `app/api/stripe/checkout/route.js` (create checkout session) and `app/api/stripe/webhook/route.js` (handle subscription events). Store subscription status in the database.

### 3. Database (TODO)
- Stories, saved boards, and custom sounds are currently stored in `localStorage`.
- `/api/sounds` reads from a static JSON file.
- **Next step**: Connect Supabase (or PlanetScale). Migrate story/board data to user-scoped database rows. Replace `saved-sounds.json` read with a DB query.

### 4. OpenAI / AI analysis (TODO)
- Currently `POST /api/analyze` proxies to the external Render backend.
- **Next step**: Move the OpenAI call into the Next.js route handler directly. The API key stays server-side only and is never sent to the browser. Remove the Render dependency.

### 5. Service Worker (DONE)
- Registration handled via `useEffect` in `AppShell.jsx`.

### 7. Terms & Privacy Pages (DONE)
- `app/terms/page.jsx` and `app/privacy/page.jsx` created with full content.

---

## Broken / Incomplete Pieces

| Issue | Severity | Notes |
|---|---|---|
| ~~No favicon.svg in `/public`~~ | ~~Low~~ | **RESOLVED** — `favicon.svg` added |
| ~~Service worker not registered~~ | ~~Medium~~ | **RESOLVED** — registered via `useEffect` in `AppShell.jsx` |
| ~~`/terms` and `/privacy` links 404~~ | ~~Low~~ | **RESOLVED** — pages created |
| Manage Billing URL hardcoded | Low | `https://billing.stripe.com/p/login/` — should be env var |
| External Render backend still required | Medium | `/api/analyze` proxies to Render. Render must be running for AI features |
| `window.Howl` CDN reference removed | Fixed | Howler now imported as npm package — no action needed |

---

## Recommended Next Steps (in order)

1. ~~**Smoke test**~~ — Done
2. ~~**Add favicon**~~ — Done
3. **Add `.env.local`**: Copy `.env.example` → `.env.local` and set `NEXT_PUBLIC_BACKEND_URL`.
4. ~~**Service worker**~~ — Done
5. **Auth layer**: Add NextAuth.js or Clerk. Gate the dashboard behind session check.
6. **Stripe**: Build the subscription checkout flow.
7. **Database**: Connect Supabase. Migrate localStorage data (stories, boards, custom sounds) to the DB.
8. **Move AI calls server-side**: Delete the Render backend. The OpenAI key lives only in Next.js env.
9. **Deploy to Vercel**: `git push` → Vercel auto-deploys. Set env vars in Vercel dashboard.

---

## Running Locally

```bash
cd SuiteRhythm-next
cp .env.example .env.local   # or create manually
npm run dev
# → http://localhost:3000/dashboard
```

## Building for Production

```bash
npm run build
npm start
```

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (first time)
vercel

# Subsequent deploys
vercel --prod
```

---

## Batch 3 — Deep Module Wiring

Five standalone modules that previously existed as unused/under-used scaffolding are now wired into the hot path of `engine/SuiteRhythm.js`. This is the "class split" from the original roadmap, reframed: instead of a risky multi-file split of the 9.7k-line class, each module now owns one concern inside the engine.

### What each module now drives

| Module | New behavior inside `SuiteRhythm` |
|---|---|
| `priority-budget.js` | Every `playSFXBuffer` and `playBufferDirect` cue now reserves a slot via `priorityBudget.add()` and releases it on `onend`. Stinger cues can evict the oldest ambient/sfx cue with a 200ms fade instead of layering on top. SFX-cap overflow is skipped rather than played. |
| `howl-lru.js` | `this.howlPool = new HowlLRU(32)` in the constructor. `playSFXBuffer` checks the pool for a decoded Howl before creating a new one (rapid repeat triggers reuse). On non-loop `onend`, Howls are returned to the pool instead of being unloaded — eviction is LRU-based and only non-playing Howls are unloaded. `destroy()` calls `howlPool.clear()`. |
| `duration-scheduler.js` | `scheduleNextStinger()` now calls `waitBeforeStart(this._cueTimeline, { category:'stinger', durationMs:2000 })` to delay the next stinger if one is still playing, and `cooldownFor(choice, 'stinger')` to size the post-cue gap (2.5s default, 6s for ambient-style IDs). No more machine-gunned thunder. |
| `keyword-learning.js` | `checkInstantKeywords` blends the configured `keywordCooldownMs` with `learnedKeywordCooldown(keyword)` (40/60 weighted average). Every trigger calls `recordKeywordFire(keyword)` so spammy keywords naturally stretch their own cooldowns and rare ones tighten up. |
| `raf-coalesce.js` | `startVisualizer()` and `_setupMicIntensityAnalyser()` no longer self-schedule with `requestAnimationFrame`. Both register a callback on `getSharedTicker()`, so one rAF loop drives visualizer + mic RMS sampling. Handles are stored as `_visualizerTickHandle` / `_micSampleTickHandle` and released in `stopVisualizer()`, `stopListening()`, and `destroy()`. Legacy `visualizerAnimationId` / `_micSampleRAF` paths are kept as fallback when the ticker is unavailable (SSR/tests). |

### New engine fields

Added in the constructor immediately after `this.priorityBudget = new PriorityBudget(...)`:

- `this.howlPool` — `HowlLRU(32)` instance.
- `this._cueTimeline` — rolling array of `{ id, category, startedAt, durationMs, token }` entries used by `duration-scheduler`. Trimmed to 64 entries defensively.
- `this._visualizerTickHandle`, `this._micSampleTickHandle` — shared-ticker registration IDs.

Helper: `_removeFromCueTimeline(id)` — removes a cue entry by id on `onend` / `source.onended`.

### Intentionally deferred

- **`music-crossfade.js` (MusicCrossfader)** — deferred to batch (b) "Howler→WebAudio music migration" where `playMusicElement`'s manual 2.5s Howl fade will be replaced with a proper WebAudio gain-node crossfade. Wiring MusicCrossfader into the current Howler-based path would be thrown away next batch.
- **True multi-file class split** — the monolith stays one file. Each module is now a seam, so future extraction is cheap.

### Behavior changes users may notice

- Adaptive keyword cooldowns: a trigger that fires many times in a short window gets slightly longer cooldowns than configured; rare keywords respond faster.
- Stinger cadence is scheduler-aware: stingers won't interrupt still-playing stingers, and the gap after a stinger depends on its name/category.
- Memory on long sessions should be lower — the Howl pool evicts unused sounds rather than keeping every SFX decoded forever.
- Frame budget is lower when both the visualizer and mic analyser are active (one rAF loop instead of two).

### Validation

- All 35 Vitest tests pass (7 module suites unchanged).
- `next build` completes with no new warnings.

---

## Batch 4 — Music Crossfader

The 6th standalone module (`music-crossfade.js`) is now wired. `MusicCrossfader` is instantiated once in `initializeAudioContext` immediately after `musicGainNode → masterGainNode` is connected. It owns two parallel gain buses (`a`, `b`) that sit in front of `musicGainNode`, so incoming and outgoing tracks fade on independent curves instead of stepping on each other's volume.

### What changed in `playMusicElement`

- Old path: `oldHowl.fade(vol, 0, 2500)` immediately, then `newHowl.play() + newHowl.fade(0, vol, 2500)`. Two fades, two independent timelines, old Howl's stop scheduled by a naked `setTimeout`.
- New path: construct the new Howl muted, then hand it to `musicCrossfader.crossfadeToHowl(newHowl, targetVol, 2500)`. The crossfader calls `.play()` if needed, ramps the new Howl from 0 → target and the old Howl from its current volume → 0 over the same duration, then stops the old source 80ms after the fade completes. The engine still schedules `oldHowl._howl.unload()` after the fade to reclaim memory.
- Fallback: if `MusicCrossfader` failed to construct (e.g., no `AudioContext`), `playMusicElement` falls back to the previous manual dual-`.fade()` behavior.

### Why stay on Howl (html5) + crossfader

Music tracks use `html5: true` for streaming, which means they're backed by `HTMLAudioElement` instead of decoded buffers — necessary for long tracks to avoid multi-MB decode spikes. The `crossfadeToHowl` path is designed exactly for this: it coordinates two Howl fades while tracking which bus is "active", giving us centralized timing and clean teardown without forcing every track to fully decode. A future migration to raw `AudioBufferSource` for short loops can use `crossfadeToSource` on the same module with no engine-side changes.

### Teardown

`destroy()` now calls `this.musicCrossfader?.destroy?.()`, which silences both buses, stops any residual sources, and disconnects the gain nodes from `musicGainNode`.

### Validation

- All 35 Vitest tests pass.
- `next build` completes cleanly.

---

## Batch 5 — Catalog Retagging

The 572-entry sound catalog (`public/saved-sounds.json`) now runs through a deterministic retag pass. Previously every non-music entry was coerced to `type: 'sfx'`, so the engine's ambient-bed layer (`maybeUpdateAmbientBed`, `type === 'ambience'` picker) matched zero entries and was effectively dead code.

### New script: `scripts/retag-catalog.js`

Idempotent pass that:

1. **Normalizes keywords** — lowercase, trim, dedupe.
2. **Reclassifies ambience** — if an `sfx` entry's name matches the ambience whitelist (`ambience`, `ambient`, `fireplace`, `campfire`, `crickets`, `forest day/night`, `<biome> ambient`, `wind/rain bed|loop|background`, `tavern inside/background`), flip its type to `ambience`, set `loop: true`, and ensure the `ambience` + `ambient` keywords are present.
3. **Adds genre tags** — name + keyword regex match adds one or more of: `fantasy`, `horror`, `tavern`, `christmas`, `halloween`, `scifi`, `combat`, `nature`, `weather`.

```
node scripts/retag-catalog.js           # dry-run summary
node scripts/retag-catalog.js --write   # overwrite saved-sounds.json
```

### What changed in the catalog

| Stat | Count |
|---|---:|
| Entries total | 572 |
| Entries touched | 180 |
| Reclassified sfx → ambience | 23 |
| `fantasy` tag added | +62 |
| `horror` tag added | +35 |
| `nature` tag added | +30 |
| `weather` tag added | +16 |
| `combat` tag added | +14 |
| `scifi` tag added | +11 |
| `halloween` tag added | +5 |
| `christmas` tag added | +4 |

Heuristics are intentionally conservative — the ambience whitelist will miss borderline entries like "cave monster roar" (correctly stays `sfx`) rather than flip a one-shot into a loop. Edge cases can be retagged by hand; rerunning the script is safe (idempotent).

### `lib/api.js` type mapping

`fetchSounds()` previously mapped every entry to `type: 'sfx' | 'music'` and set `loop` only for music. It now preserves `type: 'ambience'` end-to-end and auto-loops it:

```js
const normalizedType = f.type === 'music' ? 'music'
    : f.type === 'ambience' ? 'ambience'
    : 'sfx';
// ...
loop: normalizedType === 'music' || normalizedType === 'ambience' || !!f.loop,
```

This is what actually wires the 23 ambience entries into the engine's ambient-bed picker.

### Behavior changes users may notice

- The ambient-bed layer picks beds now (it was silently a no-op before).
- Mood-based music scoring has more signal — every entry now carries at least one genre tag where applicable, so `calculateMusicScore` produces distinguishable rankings instead of ties.
- Scene selectors that match on `fantasy` / `horror` / `tavern` / `christmas` / `halloween` hit more entries without any engine-code changes.

### Validation

- All 35 Vitest tests pass.
- `next build` completes cleanly.
- Script is idempotent: rerunning it against the retagged catalog reports 0 further changes.

---

## Batch 6 — External Integrations

A single module now owns every "outside world → SuiteRhythm" control surface, so Stream Deck, OBS browser sources, custom bookmarklets, and Twitch chat all flow through one rate-limited handler instead of hooking into random internals.

### New module: `lib/modules/external-trigger.js`

`ExternalBridge` is installed in the engine right after `_setupObsBridge()`:

```js
this.externalBridge = new ExternalBridge(this, { rateLimitMs: 500 });
this.externalBridge.install();
```

`install()` hooks three equivalent command channels, all dispatched through the same `handle(cmd, ctx)` so authorization and rate-limiting live in one place:

1. **Direct JS API** — `window.SuiteRhythm.trigger('thunder')`, `window.SuiteRhythm.stopAll()`, `window.SuiteRhythm.scene('Combat')`, `window.SuiteRhythm.status()`, `window.SuiteRhythm.twitch.connect('aaronc1992')`.
2. **CustomEvents** — `window.dispatchEvent(new CustomEvent('suiterhythm:command', { detail: { type: 'trigger', query: 'thunder' } }))` for in-page integrations that don't want to assume `window.SuiteRhythm` is already attached.
3. **postMessage** — `window.postMessage({ suiterhythm: 'trigger', query: 'thunder' }, '*')` for iframe / OBS browser-source bridges. Cross-origin messages are gated by an `allowedOrigins` allowlist; same-origin and no-origin messages pass.

`uninstall()` is called from `destroy()`, which removes both listeners and disconnects any active Twitch session.

### Command set

| Type | Fields | Action |
|---|---|---|
| `trigger` | `query`, `options?` | Exact id/name match first (for Stream Deck buttons), fuzzy `searchAudio` fallback, then `playAudio`. |
| `stopAll` | — | Calls `engine.stopAllAudio()`. |
| `scene`   | `name` | Case-insensitive lookup in `engine.scenePresets`, then `applyScenePreset`. |

Unknown command types return `{ ok: false, error: 'unknown command' }` instead of throwing, so older clients don't crash when a newer bridge adds commands.

### Rate limiting

Per-command-key rate limit (`type:query`) defaults to 500ms. A chat-bot flood hitting `!sfx thunder` 20× in one second will fire once; other triggers are unaffected.

### Twitch chat bridge (read-only, no OAuth)

Anonymous IRC over `wss://irc-ws.chat.twitch.tv:443` using a `justinfan<rand>` nickname — we can only read, never write, which is exactly what we want for sound triggers. Supports:

- `!sfx <query>` → `trigger`
- `!stop`         → `stopAll`
- `!scene <name>` → `scene`

Non-bang chat is ignored. The client reconnects with exponential backoff capped at 30s.

### Tests

`tests/external-trigger.test.js` covers 9 cases: API registration, fuzzy fallback, unknown-command guard, rate limiting, CustomEvent dispatch, `status()` snapshot, scene preset match + miss, and `uninstall()` listener cleanup. The tests use a minimal `window` polyfill so they don't pull in JSDOM.

### Validation

- 44/44 Vitest tests pass (35 → 44, +9 for the new bridge).
- `next build` completes cleanly.
- `window.SuiteRhythm` is now a public, documented surface — external controllers can depend on it.




---

## Batch 7 - Keyword Enrichment (engine match quality)

**Goal**: every catalog entry carries enough well-chosen keywords for the engine's AI Director, `searchAudio` fuzzy fallback, scene-preset matcher, and ambient-bed picker to find the right sound.

**New script**: `scripts/enrich-keywords.js` (sibling of `retag-catalog.js`).

Rule-driven, additive, idempotent:

1. **Name tokenization** - every significant word in `name` becomes a keyword (stopwords stripped).
2. **Synonym expansion** - ~150 trigger rules covering weapons, magic, weather, biomes, creatures, moods, genres, and role cues (e.g. `sword` -> `blade/weapon/melee`; `rain` -> `weather/storm/water`; `lovecraft` -> `cosmic/horror/eldritch`).
3. **Mood backfill** (music + ambience only) - if no mood tag is present, infer one from {heroic, tense, combat, dark, horror, mystery, peaceful, sad, joyful, romantic, whimsical, exploration, magical}.
4. **Context backfill** (music + ambience only) - infer a location tag from {tavern, city, dungeon, forest, mountain, sea, desert, swamp, temple, castle, battlefield, wilderness, space, feywild, graveyard, weather}.
5. **Normalize** - lowercase, trim, dedupe, drop stopwords, cap at 20 keywords with retag's genre tags (`fantasy/horror/tavern/combat/nature/weather/christmas/halloween/scifi`) protected from trimming so the two scripts converge.

**Result** (572 catalog entries, 128 music / 23 ambience / 421 sfx):

| Metric | Before | After |
| --- | ---: | ---: |
| Avg keywords per entry | ~6 | **13.9** |
| Net keywords added | - | **~2,400** |
| Entries below 5 keywords | 4 | **0** |

**Pipeline**: `keywords:write` -> `catalog:write` (retag may add new genre tags triggered by new synonyms) -> rerun once; both scripts report clean.

**CI**: added `npm run keywords:check` to `.github/workflows/ci.yml` alongside `catalog:check`. CI fails if keyword enrichment would add new tags - same drift-prevention model as the retag script.

**npm scripts**:
- `npm run keywords:check` - exit 1 if catalog keywords would change.
- `npm run keywords:write` - apply enrichment to `public/saved-sounds.json`.
