# Admin User Dashboard — Design Spec

- **Date:** 2026-08-29
- **Owner:** Yoav Pintel (sole admin)
- **Status:** Approved design → ready for implementation plan
- **Scope:** v1, **view-only**

## 1. Goal

Give the admin (Yoav only) an internal screen to see everyone who has signed
in to maslul-app and how they use it: per-user trip counts, AI-builder vs
manual usage, tokens spent, and the list of maps each user has built — plus
top-line totals. Ship before public launch.

## 2. Non-goals (v1)

- **No management actions.** No delete/ban/quota-reset/cap-change. Read-only.
- No charts/time-series beyond the "this week" token figure. Flat tables + KPIs.
- No pagination UI for a huge user base (current scale is small; the endpoint
  returns all users). Revisit if the user count grows past a few hundred.
- No historical token backfill — token capture starts at deploy; past
  generations show 0 tokens.

## 3. Approach (chosen)

**Admin serverless endpoint + `service_role`.** A new `GET /api/admin/overview`
verifies the caller is an admin (their Supabase access token → email ∈
`ADMIN_EMAILS`), then uses `SUPABASE_SERVICE_ROLE_KEY` to read across all users
(bypassing RLS) and returns a single aggregated JSON payload. The service-role
key never reaches the browser; the admin check is enforced server-side. This
mirrors the existing `api/generate-trip.js` (token → user identity, ADMIN_EMAILS)
and `api/ai-errors-digest.js` (service-role reads) patterns.

Rejected: admin-wide RLS `select` policies (exposes all rows to the browser via
the anon key and still cannot read `auth.users` for email / last-sign-in).

## 4. Data model changes (going-forward capture)

Two small additions, both additive and backward-compatible (old rows = null →
treated as 0 / "unknown").

### 4.1 `ai_generations` — token + kind columns
`api/generate-trip.js` already inserts one row per generation via
`recordGeneration(userId, token)` with `{ user_id }`. Extend it to also store:

| column | type | source |
|---|---|---|
| `prompt_tokens` | `int` | Gemini `usageMetadata.promptTokenCount` |
| `output_tokens` | `int` | Gemini `usageMetadata.candidatesTokenCount` |
| `total_tokens` | `int` | Gemini `usageMetadata.totalTokenCount` |
| `kind` | `text` | `'create'` or `'refine'` (from the request `refine` flag) |

`callGemini()` (currently returns `{ text, truncated }`) must also surface
`usage` from the API response so `recordGeneration` can persist it. If
`usageMetadata` is absent, store nulls (do not fail the generation).

### 4.2 `trips.source` — AI vs manual
Today `source` (`'ai'` when `seedDays` present, else `'wizard'`) is sent **only
to PostHog**, not persisted to the `trips` row. Add a `source text` column to
`trips` and populate it on create (`row.source = seedDays ? 'ai' : 'wizard'`).
Historical trips have `source = null` → the dashboard buckets them as
`"לא ידוע"` (unknown), shown separately from ai/manual so counts stay honest.

### 4.3 Migration
A single SQL migration file (`supabase_migration_admin_metrics.sql`):
```sql
alter table ai_generations
  add column if not exists prompt_tokens int,
  add column if not exists output_tokens int,
  add column if not exists total_tokens  int,
  add column if not exists kind          text;

alter table trips
  add column if not exists source text;
```
No RLS changes required (the admin endpoint uses the service role).

## 5. Backend — `GET /api/admin/overview`

### 5.1 Auth
1. Read the caller's Supabase access token from the `Authorization: Bearer`
   header. Resolve identity via `GET {SUPA_URL}/auth/v1/user` (as in
   generate-trip's `getUser`).
2. If the email is not in `ADMIN_EMAILS` → `403 { error: "forbidden" }`.
3. If `SUPABASE_SERVICE_ROLE_KEY` or `SUPA_URL` is missing →
   `503 { error: "not-configured" }`.

### 5.2 Reads (service role)
All reads use the service-role key (`apikey` + `Authorization: Bearer <service>`):
- **Users:** GoTrue admin `GET /auth/v1/admin/users` (paged) → `{ id, email,
  created_at, last_sign_in_at }` for every user.
- **Trips:** `GET /rest/v1/trips?select=id,title,owner_id,source,is_public,last_edited,created_at`.
- **AI generations:** `GET /rest/v1/ai_generations?select=user_id,total_tokens,created_at,kind`.

### 5.3 Aggregation (in the function)
Join by user id. Produce:

```jsonc
{
  "kpis": {
    "users": 0, "activeThisWeek": 0, "trips": 0,
    "aiUses": 0, "tokensTotal": 0, "tokensThisWeek": 0
  },
  "users": [
    {
      "id": "…", "email": "…",
      "joinedAt": "ISO", "lastActiveAt": "ISO|null",
      "trips": { "total": 0, "ai": 0, "manual": 0, "unknown": 0 },
      "aiUses": 0,
      "tokens": { "total": 0, "thisWeek": 0 },
      "maps": [ { "id":"…", "title":"…", "source":"ai|wizard|null", "public":false, "lastEdited":"ISO" } ]
    }
  ]
}
```

- `activeThisWeek` = users whose `last_sign_in_at` OR any generation/trip edit
  falls in the current week window (reuse generate-trip's `weekStart()`
  Sunday-00:00-UTC definition for consistency).
- `tokensThisWeek` sums `total_tokens` of generations since `weekStart()`.
- Sort `users` by `lastActiveAt` desc by default (server-side); the client can
  re-sort.

### 5.4 Errors & limits
- Any single sub-read failing degrades gracefully (that section is empty/0) and
  is noted in a `warnings: []` array rather than failing the whole response.
- Response is uncached (`Cache-Control: no-store`) — admin wants live data.

## 6. Frontend — `/admin`

### 6.1 Entry & gating — **HARD REQUIREMENT: admin-only, no exceptions**
Only **`yoav.pintel@gmail.com`** may ever see this page, its menu entry, or its
data. This is the single most important constraint of the feature; every other
detail is negotiable, this is not.

- **Side-menu entry** ("ניהול") is rendered **only** when
  `isAdminEmail(user?.email)` is true. Any other user (signed-in or guest) must
  not see the entry at all — not disabled, not greyed out: **absent**.
- **Route `/admin`** is rendered only when `isAdminEmail(user?.email)`; every
  other visitor (guest, or any non-admin signed-in user) is redirected to
  `/dashboard` and sees nothing of the page.
- **Client gate is UX only** — a non-admin who types the URL or crafts a request
  still gets **nothing**, because the endpoint (§5.1) returns `403` for any
  non-admin token and the page has no data without it.
- Defense in depth: three independent gates must all hold — menu visibility,
  route render, and the server `403`. Removing any one still leaves the data
  protected by the others; the server `403` is the authoritative one.

### 6.2 Layout (RTL, brand tokens: ink `#0D0F11`, accent `#E0533F`, charcoal)
1. **KPI strip** — 6 stat tiles (users · active this week · trips · AI uses ·
   tokens total · tokens this week), tabular-nums.
2. **Users table** — columns: אימייל · הצטרפות · פעילות אחרונה · מסלולים
   (total, with ai/manual split) · שימושי AI · טוקנים. Client-sortable by any
   numeric column. Search-by-email box.
3. **User detail** — clicking a row opens a side panel/drawer with that user's
   **maps list** (title · source badge ai/ידני/לא-ידוע · public? · last edited)
   and the token/AI breakdown.
4. States: loading skeleton, empty ("אין עדיין משתמשים"), error (with retry).

### 6.3 Data fetch
Single `GET /api/admin/overview` with the user's Supabase token in the
`Authorization` header. No client-side aggregation of raw cross-user data (the
endpoint already aggregates).

## 7. Security

- Admin identity verified **server-side** on every request; never trust a
  client flag. Single source of truth: `ADMIN_EMAILS` (server) mirrored by
  `isAdmin.js` (client, UX only).
- `service_role` key stays server-side; never sent to the browser or embedded
  in the bundle.
- **New critical-check** (`scripts/critical-checks.js`): assert that
  `api/admin/*` handlers verify the caller is an admin *before* issuing any
  service-role read (guards against a future edit that forgets the gate).

## 8. Prerequisites

- Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project env (already
  used by `ai-errors-digest.js`, so likely present).
- Run the SQL migration (§4.3) against the Supabase project.

## 9. Verification

- Endpoint: `403` for a non-admin token; `200` + aggregated JSON for the admin
  token; `503` when service role is unset.
- Token capture: after a real AI generation, the new `ai_generations` row has
  non-null `total_tokens`.
- `trips.source`: a newly created AI trip and a wizard trip land with the right
  `source`.
- UI (positive): `/admin` renders KPIs + table for `yoav.pintel@gmail.com`;
  a user row opens the maps list; the "ניהול" menu entry is present.
- **UI (negative — critical):** signed in as a NON-admin, the "ניהול" menu
  entry is absent, and typing `/admin` redirects to `/dashboard` with no data
  fetched. As a guest (signed out): same — no entry, redirect, nothing.
- **Endpoint (negative — critical):** a non-admin's token to
  `/api/admin/overview` returns `403` with no data body.
- Pre-deploy: `npm run critical` (incl. the new admin-gate check) + `verify:prod`.

## 10. Open questions

None blocking. Future (post-v1): management actions (quota reset, cap change,
delete), time-series charts, CSV export, pagination for large user bases.
