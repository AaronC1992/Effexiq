# Effexiq — Next.js Migration Notes

## What Was Moved

| Original file/folder | New location | Change |
|---|---|---|
| `index.html` | `components/AppShell.jsx` + `components/sections/` + `components/modals/` | Converted HTML to JSX, split into React components |
| `game.js` | `engine/Effexiq.js` | Updated import paths; exports class instead of auto-initializing |
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

**Engine initialization**: `game.js` previously auto-initialized via `DOMContentLoaded`. In Next.js, the `Effexiq` class is exported and instantiated inside a `useEffect` in `AppShell.jsx` after the React component has mounted. This preserves the same timing (DOM is ready before the engine runs).

**Dynamic import with `ssr: false`**: `AppShell` is loaded via `next/dynamic` with `ssr: false` on the dashboard page. This prevents the audio engine (which uses `window.AudioContext`, `SpeechRecognition`, `localStorage`, `Howler`) from executing on the server during SSR.

**Howler.js**: Was loaded from CDN (`<script src="howler.min.js">`). Now installed as an npm package (`howler@2.2.4`) and imported at the top of `engine/Effexiq.js` via `import { Howl } from 'howler'`.

**CSS**: All styles moved to `app/globals.css` and automatically applied globally by the root layout. No CSS Modules were introduced — the existing class-based system works fine as-is.

**API routing**: The frontend now points to `/api/*` routes (Next.js handlers) instead of the external Render backend directly. The `/api/analyze` route currently proxies to the Render backend. This proxy can be removed once the AI logic is moved server-side.

**Module resolution**: All JS modules now use relative paths correctly:
- `lib/modules/*.js` import `from '../config.js'` → resolves to `lib/config.js` ✓
- `lib/integration.js` imports `from './config.js'` → resolves to `lib/config.js` ✓
- `engine/Effexiq.js` imports updated from `./config.js` → `../lib/config.js` ✓

### React component decisions

The UI was split into React components for code organization, but **the Effexiq engine still manages all UI state via direct DOM manipulation**. React components render the HTML scaffold; the engine wires up all event listeners and mutations via `getElementById` / `classList` / `innerHTML`. This is intentional — the engine is 7,000+ lines of tightly coupled DOM code that cannot be safely "React-ified" in a single migration without a full rewrite.

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

### 5. WebSocket / Deepgram (TODO)
- The old Express server had a WebSocket endpoint for Deepgram real-time transcription (not yet used by the frontend).
- Next.js serverless functions don't support persistent WebSockets natively.
- **Next step**: Use [Next.js custom server](https://nextjs.org/docs/pages/building-your-application/configuring/custom-server) or deploy the Deepgram relay as a separate microservice (the existing `server/index.js` works for this).

### 6. Service Worker (TODO)
- `public/service-worker.js` is present but the registration script from `index.html` was not automatically carried over (it was a raw `<script>` tag).
- **Next step**: Add service worker registration in a `useEffect` in `app/layout.jsx` or use a library like `next-pwa`.

### 7. Custom domain terms/privacy pages (TODO)
- Links to `/terms` and `/privacy` are in the modals and settings. These pages don't exist yet.
- **Next step**: Create `app/terms/page.jsx` and `app/privacy/page.jsx`.

---

## Broken / Incomplete Pieces

| Issue | Severity | Notes |
|---|---|---|
| No favicon.svg in `/public` | Low | Add `favicon.svg` to the `/public` folder. Referenced in `app/layout.jsx`. |
| Service worker not registered | Medium | Registration script was inline in `index.html`. Needs `useEffect` in layout or `next-pwa` |
| `/terms` and `/privacy` links 404 | Low | Pages not created yet |
| Manage Billing URL hardcoded | Low | `https://billing.stripe.com/p/login/` — should be env var |
| External Render backend still required | Medium | `/api/analyze` proxies to Render. Render must be running for AI features |
| `window.Howl` CDN reference removed | Fixed | Howler now imported as npm package — no action needed |

---

## Recommended Next Steps (in order)

1. **Smoke test**: Run `npm run dev` and verify the UI loads at `http://localhost:3000/dashboard`. Check browser console for engine init errors.
2. **Add favicon**: Drop `favicon.svg` (or `favicon.ico`) into `/public`.
3. **Add `.env.local`**: Copy `.env.example` → `.env.local` and set `NEXT_PUBLIC_BACKEND_URL`.
4. **Service worker**: Add registration via `next-pwa` or a `useEffect` in the root layout.
5. **Auth layer**: Add NextAuth.js or Clerk. Gate the dashboard behind session check.
6. **Stripe**: Build the subscription checkout flow.
7. **Database**: Connect Supabase. Migrate localStorage data (stories, boards, custom sounds) to the DB.
8. **Move AI calls server-side**: Delete the Render backend. The OpenAI key lives only in Next.js env.
9. **Deploy to Vercel**: `git push` → Vercel auto-deploys. Set env vars in Vercel dashboard.

---

## Running Locally

```bash
cd Effexiq-next
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
