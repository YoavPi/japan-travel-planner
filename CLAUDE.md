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

## Deploy

Production is the **`saas-builder-local`** branch → **`maslul-app.vercel.app`** (Vercel project `japan-trip-explorer`; `.vercel/` is linked to it, and it also serves `japan-trip-explorer.vercel.app`).

```bash
npm run deploy   # preflight (critical + CI build) → npx vercel deploy --prod → verify:prod
```

- Any sub-step failure aborts. The `vercel deploy` step (`scripts/deploy.mjs`) auto-retries this project's known spurious "Not authorized" first-attempt failure; if every retry fails, check `npx vercel whoami` (should be `yoavpintel-2200`).
- Plain `git push origin saas-builder-local` only makes a Vercel **Preview** — production ships through the `vercel --prod` step in `npm run deploy`. (Optional cleanup: set the Vercel project's Production Branch to `saas-builder-local` to make production push-triggered.)
- **`main` is deliberately frozen** — an old snapshot feeding `japan-travel-planner-eosin.vercel.app`. Its commit lag is by design. **Never merge `saas-builder-local` into `main`**, never redeploy the frozen project. See [docs/architecture.md](docs/architecture.md).
- "Deploy to prod" → the `deploy-sentinel` agent checks the tree/branch and, if green, runs `npm run deploy` automatically.

## Working rules

- This is a live product with real users. Don't touch auth, DB schema, API contracts, env vars, Vercel config, routes, or business logic unless the task explicitly calls for it.
- Design work: use the `impeccable` skill (`.claude/skills/impeccable/`) — it already knows this project's PRODUCT.md/DESIGN.md and design rules. Don't duplicate its guidance here.
- Current working branch is `saas-builder-local`, not `main` — check `git branch` before assuming.
- Prefer small, verifiable changes with a build/test check after each one over large batched edits.

## Sub-agents

Fifteen project agents live in `.claude/agents/`. Dispatch the narrowest one that fits; `architect` before anything non-trivial.

| agent | use it for |
|---|---|
| `architect` | design/plan a non-trivial change before coding (no code, read-only) |
| `builder` | implement a scoped React feature/fix not owned by a specialist |
| `ux-critique` | diagnose why an existing screen confuses users — heuristic audit, read-only, run it BEFORE any redesign |
| `product-designer` | design an authenticated app surface end-to-end (IA, disclosure tiers, states) — spec, not code |
| `landing-designer` | design the public marketing surfaces (`/`, `/japan`, `/gallery`) — hero, CTA hierarchy, proof |
| `design-systems` | tokens, light/dark contract, `Icon.jsx` migration off emoji, shared primitives, z-index scale |
| `ai-engineer` | the Gemini generate-trip pipeline only (cost/usage tracking) |
| `budget-domain` | the trip-budget money model only — `trip.data.budget`, `src/utils/budget.js`, currency/rate math, planned-vs-actual, expense linkage |
| `db-architect` | Supabase schema, RLS, migrations |
| `growth` | PostHog/analytics, SEO/meta, the visitor→signup funnel |
| `copywriter` | Hebrew-first RTL user-facing text, CONTENT_AUDIT.md, trip content |
| `ui-impeccable` | fast design-system compliance pass on a UI diff |
| `qa` | tests, `npm run critical`, layout/RTL/a11y audit, manual test plan |
| `deploy-sentinel` | "deploy to prod" — gate (clean tree, right branch) then run `npm run deploy` |
| `product-manager` | after any feature/fix ships or is scoped — reconcile [docs/ROADMAP.md](docs/ROADMAP.md) against what actually happened, propose reprioritization |

**Work log:** after any sub-agent returns, the main session appends one line to [WORKLOG.md](WORKLOG.md) (`DATE | agent | task | files | result`) and names the agent(s) used in its reply. Sub-agents don't write to the log themselves.

**Roadmap:** after any feature or fix ships or is scoped — regardless of whether a sub-agent, the main session, or the user did the work — invoke `product-manager` to reconcile [docs/ROADMAP.md](docs/ROADMAP.md): move finished work into בוצע, log real follow-ups/tech debt, and propose (not force) a reordering of what's next. This runs in addition to the WORKLOG.md line above, not instead of it.

## More information

- Product: [PRODUCT.md](PRODUCT.md)
- Design system: [DESIGN.md](DESIGN.md)
- Architecture / infra: [docs/architecture.md](docs/architecture.md)
- Content inventory: [CONTENT_AUDIT.md](CONTENT_AUDIT.md)
- Feature ideas not yet scheduled: [docs/ROADMAP.md](docs/ROADMAP.md)
- QA process: [.claude/agents/qa.md](.claude/agents/qa.md)
- Design process: [.claude/skills/impeccable/SKILL.md](.claude/skills/impeccable/SKILL.md)
