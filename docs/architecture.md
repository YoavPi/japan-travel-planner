# Architecture

## One codebase, two audiences

`japan-trip-explorer` (this repo) is Maslul in full: a public marketing/demo layer and the authenticated core product, in a single Create React App, split by route.

| Route | Layer | Auth |
|---|---|---|
| `/japan`, `/map` | Marketing / demo (Japan-trip explorer experience) | none |
| `/gallery`, `/g/:tripId` | Public gallery, shared trips | none |
| `/`, `/welcome`, `/auth` | Landing / onboarding / sign-in | none |
| `/dashboard`, `/create`, `/map/edit/:tripId`, `/trip/overview/:tripId`, `/settings`, `/notifications` | Core product | required |
| `/admin` | Internal ops (KPIs, user & AI-usage metrics) | admin only |

## Deployment — two Vercel projects, one GitHub repo

Both `maslul-app.vercel.app` and `japan-travel-planner-eosin.vercel.app` are Vercel projects linked to `github.com/YoavPi/japan-travel-planner`, same branch.

- **`maslul-app.vercel.app`** — the live product. Actively redeployed on every push. Also answers on `japan-trip-explorer.vercel.app` (same Vercel project, extra domain).
- **`japan-travel-planner-eosin.vercel.app`** — **intentionally frozen** at an older deploy (last updated well before the August admin/gallery work), kept as-is by decision. Not part of the active deploy pipeline. Don't redeploy or reconfigure it without explicit sign-off.

The local checkout is linked (`.vercel/project.json`) to `maslul-app`.

## Stack

- **Frontend:** React 19, Create React App (react-scripts), react-router-dom
- **Map:** MapLibre GL + react-map-gl, Mapbox tiles (`REACT_APP_MAPBOX_TOKEN`); Google Places for live search/photos with a local geometric fallback when no key is set
- **Auth:** Google OAuth (`@react-oauth/google`) over Supabase sessions — see `src/context/AuthContext.jsx`, `src/services/authService.js`
- **DB:** Supabase (Postgres + RLS). Base schema in `database-schema.sql`; incremental changes as loose `supabase_migration_*.sql` files in the repo root (not yet organized into a `migrations/` folder — see open items below)
- **Backend:** Vercel serverless functions under `api/` — AI trip generation (Gemini, `api/generate-trip.js`), admin metrics (`api/admin/overview.js`), AI-error digest
- **Analytics:** PostHog (EU) + Vercel Web Analytics, consent-gated (`src/analytics/`)

## Tests

Two separate runners: Jest for `src/` (`npm test`), Node's built-in test runner for `api/_lib/` (`npm run test:api`). `npm run critical` (`scripts/critical-checks.js`) is a fast static gate encoding known incident classes (mock-auth leak, ownership bypass, demo-mode silently shipping) — always run it first, before anything else.

## Known open items (not addressed by the doc reorg — flagged for a future, separately-approved pass)

- 10 `supabase_migration_*.sql` files sit loose in the repo root with no folder or enforced ordering.
- A duplicate, drifted copy of the design tokens exists as a global Claude Code skill (`~/.claude/skills/saas-trip-builder-design`), generated once outside this repo and not kept in sync with `DESIGN.md`.
- A few hooks (`useActiveTrip`, `useIsDesktop`, `usePlacePhotos`) live in `src/utils/` instead of `src/hooks/`.
