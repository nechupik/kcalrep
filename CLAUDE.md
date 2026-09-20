# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A calorie/macro tracking web app ("kcalrep") built with Vite + React + TypeScript + shadcn/ui, using Firebase (Auth + Firestore) as the backend. There is no server component — all business logic, including third-party API calls (Gemini), runs client-side in the browser. This is a private app for a small, fixed set of known users (an admin and a partner), not a multi-tenant SaaS — see "Access model" below.

## Commands

```bash
npm run dev          # start Vite dev server (port 8080)
npm run build         # production build
npm run build:dev     # development-mode build
npm run lint           # eslint .
npm run test            # vitest run (single run, CI mode)
npm run test:watch    # vitest watch mode
npm run preview        # preview a production build
```

Run a single test file: `npx vitest run src/lib/cycle-engine.test.ts`
Run tests matching a name: `npx vitest run -t "phase"`

This repo uses `bun.lock`/`bun.lockb` as well as `package-lock.json`; `npm` scripts work regardless of which lockfile you install with.

There is no backend/functions directory — `firebase.json` only wires up Firestore rules/indexes (no Cloud Functions, no Netlify Functions). Deployment is static hosting via Netlify (`netlify.toml`, `npm run build` → `dist`).

### MCP server (local, read-only, not part of the web app)

[mcp-server/](mcp-server/) is a separate npm package (own `package.json`, `node_modules`, tests) — a local stdio MCP server that lets Claude read the admin's data — deliberately only what the site's «Выгрузка данных» export contains (diary, weight, body composition, activity, norms and their history), and nothing else (no cycle data, no product/recipe catalogue, no other users). It is never deployed or bundled; Vite/Netlify ignore it. Setup and tool list: [mcp-server/README.md](mcp-server/README.md). Commands, run from `mcp-server/`: `npm run build`, `npm test`.

- It reads with the Google Cloud Firestore client + a service account (Cloud Datastore Viewer role), so it **bypasses `firestore.rules`** — what it may touch is decided by `mcp-server/src/firestore-source.ts` alone, and tests enforce that file: no write calls, only `users/{uid}` paths, no cycle/catalogue/usage-stats collections. Keep it that way: don't add write methods to its `DataSource`, and don't widen what it reads without the user asking.
- `mcp-server/src/report.ts` is a port of `src/lib/exportReport.ts`, so Claude gets the same document the site downloads. If you change the site's export (sections, columns, wording, rounding), change the port with it.
- `mcp-server/src/models.ts` mirrors the Firestore document shapes from `src/lib/firestore.ts`. If the app adds or renames fields the export uses, update the matching mapper there. Manual norms store placeholder BMR/TDEE (`bmr = tdee = calories`); the models flag this as `energyEstimated: false`.
- Service-account keys must never be committed; `.gitignore` blocks the usual filenames, but keep the key outside the repo.

## Environment variables

Vite env vars (`VITE_*`) are required in `.env` (see `.env.example` for the Firebase set):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `VITE_GEMINI_API_KEY` — used directly in the browser by [src/lib/gemini.ts](src/lib/gemini.ts) to call the Gemini API. This key is bundled into the client build, not proxied through a backend.

## Architecture

### Data layer: three-tier fallback pattern

Most read/write logic follows a consistent layering, thinnest to thickest:

1. **[src/lib/firestore.ts](src/lib/firestore.ts)** — raw Firestore CRUD (`saveNorm`, `loadDiary`, `saveWeight`, `saveActivity`, admin bulk-delete helpers, etc.), keyed under `users/{userId}/...` subcollections, plus top-level `shared_products`/`shared_recipes` collections.
2. **[src/lib/storage.ts](src/lib/storage.ts)** — the app-facing API (`saveNorm`, `loadNorm`, `loadDiary`, `addDiaryEntry`, ...). If a user is signed in, it calls firestore.ts; on any Firestore error, or when signed out, it transparently falls back to `localStorage`. Callers (components/pages) should generally go through this layer, not firestore.ts directly, unless doing shared/admin data or cycle/metabolic data (which live in their own modules).
3. Domain-specific data modules follow the same pattern: [src/lib/metabolic-firestore.ts](src/lib/metabolic-firestore.ts) for cycle tracking data, [src/lib/products.ts](src/lib/products.ts) / [src/lib/recipes.ts](src/lib/recipes.ts) for the shared food/recipe database.

### Metabolic/cycle engine

[src/lib/cycle-engine.ts](src/lib/cycle-engine.ts) is pure, side-effect-free logic (no Firebase imports) operating on types from [src/lib/metabolic-types.ts](src/lib/metabolic-types.ts). It predicts the next menstrual cycle from history (weighted median + MAD-based confidence), computes phase boundaries, derives calorie/macro adjustments per phase, and does EMA-based symptom learning. It's the one file with a real unit test suite ([src/lib/cycle-engine.test.ts](src/lib/cycle-engine.test.ts)) — follow that pattern (pure functions, table-driven date math) if extending it. `getCycleCalorieAdjustmentForDate` is composed into the daily norm via `loadEffectiveNorm` in storage.ts, so the diary/calorie UI reflects cycle-phase adjustments automatically.

### Norm (macro target) calculation

[src/lib/nutrition.ts](src/lib/nutrition.ts) has several parallel `calculateMacros*`/`recalculateNormWith*` functions (base calculator, body-composition-adjusted via Katch-McArdle, and watch/TDEE-based) — each independently derives BMR → TDEE → calories → protein/fat/carbs with gender-specific floors (min calories, min fat). When changing macro math, check whether the change needs to be mirrored across all of these, since they don't share a common core. `saveNorm` in firestore.ts also writes a dated `normHistory/{YYYY-MM-DD}` snapshot alongside the current `norm/main` doc — preserve that when touching norm-saving code.

### AI analytics (Gemini)

[src/lib/nutritionAnalytics.ts](src/lib/nutritionAnalytics.ts) builds the `NutritionAnalyticsInput` from diary/weight/norm history; [src/lib/gemini.ts](src/lib/gemini.ts) turns that into a Russian-language prompt, calls the Gemini `generateContent` REST endpoint directly from the browser (with retry on 429/503, exponential backoff), and parses/validates the JSON response into `AIAnalyticsResult`. Responses must be valid JSON (`responseMimeType: application/json`); a `MAX_TOKENS` finish reason is treated as an explicit error rather than silently truncated.

### Access model

This is not a general-purpose multi-user app. [src/lib/config.ts](src/lib/config.ts) hardcodes `ADMIN_UID`. `firestore.rules` hardcodes both an admin UID and a "partner" UID as the only recognized identities (`isKnownUser()`); the partner has read-only access to the admin's data (diary, norm, activity) via `canPartnerReadAdminData`. All other Firestore access is strictly per-owner (`users/{userId}/...`, `isOwnerOrAdmin`). Shared collections (`shared_products`, `shared_recipes`, `categories`) are readable/writable by either known user. Keep this model in mind — features assuming arbitrary multi-tenant users don't fit the current rules.

### Routing & auth gating

[src/App.tsx](src/App.tsx) lazy-loads all page components and wraps protected routes in [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx), which redirects to `/auth` if signed out, or to `/onboarding` if signed in but has no saved norm yet (checked once per session via a ref, not re-checked on every nav). [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) wraps Firebase auth state and also eagerly loads the user's gender (from norm data) into context, since several UI pieces are gender-specific (e.g. cycle tracking).

### UI components

`src/components/ui/*` is generated shadcn/ui (Radix + Tailwind); treat these as vendored primitives rather than hand-editing extensively. App-specific composed components live directly under `src/components/`. Path alias `@/*` → `src/*` (configured in tsconfig, vite.config.ts, and vitest.config.ts — keep them in sync if it changes).

### Testing

Vitest + jsdom + Testing Library, setup at [src/test/setup.ts](src/test/setup.ts). Test files live next to the code they cover (`*.test.ts`) or under `src/test/`. Most business logic is currently untested except cycle-engine.ts — when adding tests for Firestore-backed code, mock at the `firestore.ts`/`storage.ts` boundary rather than mocking the Firebase SDK directly, matching the existing layering.
