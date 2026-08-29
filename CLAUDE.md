# CLAUDE.md

## What is Maslul

Maslul (מסלול) is a Hebrew-first, RTL-native SaaS map-builder for personal trip itineraries — live in production. This repo (`japan-trip-explorer` on disk, `saas-trip-builder` in `package.json`, `japan-travel-planner` on GitHub — three names, one product) is the entire product: a public marketing/demo experience *and* the authenticated trip-planning app, in one React codebase, split by route (see Structure below).

Product background, target user, and the full feature story live in [PRODUCT.md](PRODUCT.md) — read that, don't duplicate it here.

## Core of the product

The core is the authenticated trip-planning flow: `/dashboard` → `/create` (wizard) → `/map/edit/:tripId` (editor) → `/trip/overview/:tripId`. Everything under `/japan`, `/map` (no id), `/gallery`, `/g/:tripId` is the public marketing/demo layer that exists to lead people into the core — it supports the product, it does not compete with it. `/admin` is internal ops (KPIs, user/AI-usage metrics), not user-facing.

## What must not break

- **Auth / session / ownership code** (`src/context/AuthContext.jsx`, `src/services/authService.js`, anything touching Supabase RLS). This codebase has a documented history of a SEV1 auth-identity incident (a demo/mock user leaking into a real session). `npm run critical` encodes the known failure classes — it must pass before any deploy-relevant change ships. See [.claude/agents/qa.md](.claude/agents/qa.md).
- RTL/logical CSS, WCAG 2.2 AA, 44×44 touch targets, dark mode via `useDarkMode()` — see [DESIGN.md](DESIGN.md).
- The public demo (`/japan`, `/map?demo=1`) must keep working with zero external API keys (local fallback simulation) — it's the free-tier entry point.
- Production config: two Vercel projects are linked to this one GitHub repo — `maslul-app.vercel.app` (live, actively deployed) and `japan-travel-planner-eosin.vercel.app` (intentionally frozen snapshot, not redeployed). Don't touch Vercel project/domain/env config without explicit confirmation — see [docs/architecture.md](docs/architecture.md).

## Project structure

```
src/
  views/       route-level pages (Dashboard, Editor, Wizard, Admin, ...)
  components/  reusable UI, flat (no subfolders yet)
  services/    Supabase / auth / AI / Places / gallery calls
  data/        static trip content
  utils/       helpers (a few hooks currently live here too, alongside hooks/)
  hooks/       React hooks
  context/     React context providers
  lib/         thin client wrappers (supabase.js)
api/           Vercel serverless functions (admin, AI generation, error digest)
*.sql          Supabase migrations — currently loose in repo root (not yet organized)
docs/          architecture.md, superpowers/{plans,specs} (planning-skill output)
.claude/       agents/qa.md, skills/impeccable/
```

Full architecture notes (Vercel setup, routing split, auth/DB/map stack): [docs/architecture.md](docs/architecture.md).

## Running it

```bash
npm start          # dev server, localhost:3000
npm run build       # production build (CI=false react-scripts build)
```

Env vars: copy `.env.example` → `.env` and fill in (Mapbox, Google Maps, Google OAuth; Supabase/Gemini keys are also required locally and are not yet listed in `.env.example`).

## Tests

```bash
npm run critical      # fast pre-deploy safety gate — run this first, always
CI=true npm test -- --watchAll=false   # Jest unit/component tests
npm run test:api      # Node test runner, api/_lib/
npm run preflight     # critical + CI build, chained
```

For a full QA pass (layout/RTL/a11y, live-deploy check), use the `qa` agent — see [.claude/agents/qa.md](.claude/agents/qa.md).

## Working rules

- This is a live product with real users. Don't touch auth, DB schema, API contracts, env vars, Vercel config, routes, or business logic unless the task explicitly calls for it.
- Design work: use the `impeccable` skill (`.claude/skills/impeccable/`) — it already knows this project's PRODUCT.md/DESIGN.md and design rules. Don't duplicate its guidance here.
- Current working branch is `saas-builder-local`, not `main` — check `git branch` before assuming.
- Prefer small, verifiable changes with a build/test check after each one over large batched edits.

## More information

- Product: [PRODUCT.md](PRODUCT.md)
- Design system: [DESIGN.md](DESIGN.md)
- Architecture / infra: [docs/architecture.md](docs/architecture.md)
- Content inventory: [CONTENT_AUDIT.md](CONTENT_AUDIT.md)
- QA process: [.claude/agents/qa.md](.claude/agents/qa.md)
- Design process: [.claude/skills/impeccable/SKILL.md](.claude/skills/impeccable/SKILL.md)
