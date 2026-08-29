# Admin User Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the sole admin (`yoav.pintel@gmail.com`) a private, view-only screen listing every signed-in user with their trip counts, AI-vs-manual usage, tokens spent, and maps built.

**Architecture:** A new admin-gated serverless endpoint (`/api/admin/overview`) verifies the caller is an admin from their Supabase token, then reads across all users with the `service_role` key (bypassing RLS) and returns one aggregated JSON payload. A new `/admin` React route — reachable only from an admin-only side-menu entry and guarded by an `AdminRoute` wrapper — renders it. Token capture is added to the AI endpoint going forward; `trips.source` is persisted to distinguish AI vs manual.

**Tech Stack:** React 19 + react-router-dom v6 (CRA), Vercel Node serverless functions (CommonJS), Supabase (Postgres + GoTrue admin API + REST), Jest (`react-scripts test`) for client, `node --test` for server-side pure helpers.

## Global Constraints

- **Admin allowlist (verbatim):** `yoav.pintel@gmail.com`. Server source of truth: `ADMIN_EMAILS` env (defaults to this email). Client mirror: `src/utils/isAdmin.js`.
- **Hard requirement:** Only the admin may ever see the `/admin` page, its side-menu entry, or its data. Three independent gates must all hold: (1) side-menu entry absent for non-admins, (2) `/admin` route redirects non-admins to `/dashboard`, (3) endpoint returns `403` for any non-admin token. The server `403` is authoritative.
- **RTL Hebrew** throughout; brand tokens only: ink `#0D0F11`, accent `#E0533F`, charcoal `#1E1E24`. **No blue/teal.** Use the `P` palette from `useDarkMode()` in views where available.
- **service_role key stays server-side** — never imported into `src/` or the client bundle.
- **Commit** after each task (project rule: commits are fine; pushing/deploying only when the user asks).
- Deploy gate before any deploy: `npm run critical` (must pass) then `verify:prod` (mock-env dance per project memory).

---

### Task 1: DB migration — token + source columns

**Files:**
- Create: `supabase_migration_admin_metrics.sql`

**Interfaces:**
- Produces: columns `ai_generations.prompt_tokens|output_tokens|total_tokens|kind`, `trips.source` — relied on by Tasks 2, 4, 5, 6.

- [ ] **Step 1: Write the migration file**

Create `supabase_migration_admin_metrics.sql`:

```sql
-- Admin dashboard metrics — additive, backward-compatible (old rows = null → 0/unknown).
alter table ai_generations
  add column if not exists prompt_tokens int,
  add column if not exists output_tokens int,
  add column if not exists total_tokens  int,
  add column if not exists kind          text;

alter table trips
  add column if not exists source text;
```

- [ ] **Step 2: Run it against Supabase**

Run the SQL in the Supabase SQL editor (or `psql`). Expected: `ALTER TABLE` succeeds, no error.

- [ ] **Step 3: Verify columns exist**

Run in the SQL editor:
```sql
select column_name from information_schema.columns
where table_name='ai_generations' and column_name in ('prompt_tokens','output_tokens','total_tokens','kind');
select column_name from information_schema.columns
where table_name='trips' and column_name='source';
```
Expected: 4 rows for `ai_generations`, 1 row for `trips`.

- [ ] **Step 4: Commit**

```bash
git add supabase_migration_admin_metrics.sql
git commit -m "feat(admin): migration for token + trips.source metrics"
```

---

### Task 2: Persist `trips.source` on create

**Files:**
- Modify: `src/services/tripService.js` (the Supabase persistence `row` object, near line 651)

**Interfaces:**
- Consumes: existing `seedDays` variable in scope (truthy ⇒ AI-generated).
- Produces: `trips.source` set to `"ai"` or `"wizard"` on every new authenticated trip — read by Task 5/6.

- [ ] **Step 1: Add `source` to the persisted row**

In `src/services/tripService.js`, in the `row` object built for Supabase insert (currently ends `last_edited: nowISO(),`), add a `source` field so it matches the value already sent to PostHog:

```js
      const row = {
        id,
        owner_id: sbUser.id,
        owner_name: sbUser.user_metadata?.full_name || sbUser.email || "",
        title: trip.title,
        cover: trip.cover,
        days: trip.days,
        meta: trip.meta,
        read_only: false,
        collaborators: [],
        settings: cleanSettings,
        data: trip.data,
        last_edited: nowISO(),
        source: seedDays ? "ai" : "wizard",
      };
```

- [ ] **Step 2: Build to verify it compiles**

Run: `CI= npm run build`
Expected: build completes, "The build folder is ready".

- [ ] **Step 3: Commit**

```bash
git add src/services/tripService.js
git commit -m "feat(admin): persist trips.source (ai/wizard) for metrics"
```

---

### Task 3: AI usage pure helpers (TDD)

**Files:**
- Create: `api/_lib/aiUsage.js`
- Test: `api/_lib/aiUsage.test.js`
- Modify: `package.json` (add `test:api` script)

**Interfaces:**
- Produces:
  - `usageFromGemini(data) → { prompt:number|null, output:number|null, total:number|null }`
  - `generationRow(userId, { usage, kind }) → { user_id, prompt_tokens, output_tokens, total_tokens, kind }`
  - consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/aiUsage.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { usageFromGemini, generationRow } = require("./aiUsage");

test("usageFromGemini reads Gemini usageMetadata", () => {
  const data = { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 800, totalTokenCount: 920 } };
  assert.deepStrictEqual(usageFromGemini(data), { prompt: 120, output: 800, total: 920 });
});

test("usageFromGemini returns nulls when metadata is missing", () => {
  assert.deepStrictEqual(usageFromGemini({}), { prompt: null, output: null, total: null });
  assert.deepStrictEqual(usageFromGemini(null), { prompt: null, output: null, total: null });
});

test("generationRow builds a create row with tokens", () => {
  const row = generationRow("u1", { usage: { prompt: 1, output: 2, total: 3 }, kind: "create" });
  assert.deepStrictEqual(row, { user_id: "u1", prompt_tokens: 1, output_tokens: 2, total_tokens: 3, kind: "create" });
});

test("generationRow defaults kind to create and tokens to null", () => {
  const row = generationRow("u2", {});
  assert.deepStrictEqual(row, { user_id: "u2", prompt_tokens: null, output_tokens: null, total_tokens: null, kind: "create" });
});

test("generationRow accepts refine kind", () => {
  assert.strictEqual(generationRow("u3", { kind: "refine" }).kind, "refine");
});
```

- [ ] **Step 2: Add the `test:api` script and run to verify it fails**

In `package.json` `"scripts"`, add:
```json
    "test:api": "node --test api/_lib/",
```
Run: `npm run test:api`
Expected: FAIL — `Cannot find module './aiUsage'`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/aiUsage.js`:

```js
/* Pure helpers for recording AI-generation usage. No I/O — unit-tested. */

const num = (v) => (Number.isFinite(v) ? v : null);

/* Extract token counts from a Gemini generateContent response. */
function usageFromGemini(data) {
  const m = (data && data.usageMetadata) || {};
  return { prompt: num(m.promptTokenCount), output: num(m.candidatesTokenCount), total: num(m.totalTokenCount) };
}

/* Build the ai_generations insert row. */
function generationRow(userId, { usage = {}, kind = "create" } = {}) {
  return {
    user_id: userId,
    prompt_tokens: usage.prompt ?? null,
    output_tokens: usage.output ?? null,
    total_tokens: usage.total ?? null,
    kind: kind === "refine" ? "refine" : "create",
  };
}

module.exports = { usageFromGemini, generationRow };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/aiUsage.js api/_lib/aiUsage.test.js package.json
git commit -m "feat(admin): AI usage helpers (usageFromGemini, generationRow)"
```

---

### Task 4: Capture tokens in `generate-trip.js`

**Files:**
- Modify: `api/generate-trip.js` (`callGemini` ~line 321, `callLLM` ~line 362, `recordGeneration` ~line 183, handler call site ~line 585)

**Interfaces:**
- Consumes: `usageFromGemini`, `generationRow` from Task 3.
- Produces: each `ai_generations` row now carries token counts + `kind`.

- [ ] **Step 1: Import the helpers**

Near the top of `api/generate-trip.js` (with the other requires), add:

```js
const { usageFromGemini, generationRow } = require("./_lib/aiUsage");
```

- [ ] **Step 2: Make `callGemini` return usage**

Change the tail of `callGemini` (currently `return { text, truncated: ... };`) to:

```js
  const usage = usageFromGemini(data);
  return { text, truncated: !!cand && cand.finishReason === "MAX_TOKENS", usage };
```

- [ ] **Step 3: Thread usage through `callLLM`**

In `callLLM`, accumulate usage across attempts and attach it to the returned draft. Replace the loop body's `const call = ...` handling and the successful `return parsed;` so usage rides along:

```js
  let lastTruncated = false;
  let usage = { prompt: null, output: null, total: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    const call = GEMINI_KEY ? await callGemini(system, user) : await callAnthropic(system, user);
    lastTruncated = call.truncated;
    if (call.usage) usage = call.usage;
    let parsed = extractJson(call.text);
    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) parsed = salvageJson(call.text);
    if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
      parsed.usage = usage;
      return parsed;
    }
    if ((call.text || "").length > 400) break;
  }
```

(Note: `callAnthropic` returns no `usage`; `call.usage` is then undefined and the null default stands — token columns become null for the Anthropic fallback, which is acceptable.)

- [ ] **Step 4: Make `recordGeneration` accept usage + kind**

Replace `recordGeneration`:

```js
const recordGeneration = async (userId, token, meta = {}) => {
  try {
    await supaFetch("/rest/v1/ai_generations", {
      token, method: "POST",
      body: generationRow(userId, meta),
      headers: { Prefer: "return=minimal" },
    });
  } catch { /* best-effort */ }
};
```

- [ ] **Step 5: Pass usage + kind at the call site**

In the handler, change `await recordGeneration(userId, token);` to:

```js
    await recordGeneration(userId, token, {
      usage: draft.usage,
      kind: (body.refine || "").trim() ? "refine" : "create",
    });
```

(`draft` is the `callLLM` return value already in scope as `const draft = await callLLM({...})`.)

- [ ] **Step 6: Verify existing tests still pass and build**

Run: `npm run test:api`
Expected: PASS (Task 3 tests unaffected).
Run: `CI= npm run build`
Expected: build completes (the api dir isn't part of the CRA build, but this confirms nothing else broke).

- [ ] **Step 7: Commit**

```bash
git add api/generate-trip.js
git commit -m "feat(admin): capture Gemini token usage on each ai_generation"
```

---

### Task 5: Overview aggregation pure helper (TDD)

**Files:**
- Create: `api/_lib/adminAggregate.js`
- Test: `api/_lib/adminAggregate.test.js`

**Interfaces:**
- Produces: `aggregateOverview({ users, trips, generations, weekStartMs }) → { kpis, users }` — consumed by Task 6.
- Input shapes: `users:[{id,email,created_at,last_sign_in_at}]`, `trips:[{id,title,owner_id,source,is_public,last_edited}]`, `generations:[{user_id,total_tokens,created_at}]`.
- Output shape: `{ kpis:{users,activeThisWeek,trips,aiUses,tokensTotal,tokensThisWeek}, users:[{id,email,joinedAt,lastActiveAt,trips:{total,ai,manual,unknown},aiUses,tokens:{total,thisWeek},maps:[{id,title,source,public,lastEdited}]}] }`.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminAggregate.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { aggregateOverview } = require("./adminAggregate");

const WEEK = Date.parse("2026-08-23T00:00:00Z"); // Sunday
const inWeek = "2026-08-25T10:00:00Z";
const before = "2026-08-01T10:00:00Z";

test("aggregates trips, ai usage and tokens per user", () => {
  const out = aggregateOverview({
    users: [
      { id: "a", email: "A@x.com", created_at: before, last_sign_in_at: inWeek },
      { id: "b", email: "b@x.com", created_at: before, last_sign_in_at: before },
    ],
    trips: [
      { id: "t1", title: "Rome", owner_id: "a", source: "ai", is_public: true, last_edited: inWeek },
      { id: "t2", title: "Paris", owner_id: "a", source: "wizard", is_public: false, last_edited: before },
      { id: "t3", title: "Old", owner_id: "b", source: null, is_public: false, last_edited: before },
    ],
    generations: [
      { user_id: "a", total_tokens: 900, created_at: inWeek },
      { user_id: "a", total_tokens: 100, created_at: before },
    ],
    weekStartMs: WEEK,
  });

  assert.strictEqual(out.kpis.users, 2);
  assert.strictEqual(out.kpis.trips, 3);
  assert.strictEqual(out.kpis.aiUses, 2);
  assert.strictEqual(out.kpis.tokensTotal, 1000);
  assert.strictEqual(out.kpis.tokensThisWeek, 900);
  assert.strictEqual(out.kpis.activeThisWeek, 1);

  const a = out.users.find((u) => u.id === "a");
  assert.strictEqual(a.email, "a@x.com"); // lower-cased
  assert.deepStrictEqual(a.trips, { total: 2, ai: 1, manual: 1, unknown: 0 });
  assert.strictEqual(a.aiUses, 2);
  assert.deepStrictEqual(a.tokens, { total: 1000, thisWeek: 900 });
  assert.strictEqual(a.maps.length, 2);

  const b = out.users.find((u) => u.id === "b");
  assert.deepStrictEqual(b.trips, { total: 1, ai: 0, manual: 0, unknown: 1 });
});

test("orders users by last activity desc and tolerates orphan owner ids", () => {
  const out = aggregateOverview({
    users: [{ id: "a", email: "a@x.com", created_at: before, last_sign_in_at: before }],
    trips: [{ id: "t9", title: "Ghost", owner_id: "zzz", source: "ai", is_public: false, last_edited: inWeek }],
    generations: [],
    weekStartMs: WEEK,
  });
  assert.strictEqual(out.kpis.users, 2); // orphan owner materialized
  assert.strictEqual(out.users[0].id, "zzz"); // most recent activity first
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:api`
Expected: FAIL — `Cannot find module './adminAggregate'`.

- [ ] **Step 3: Write the implementation**

Create `api/_lib/adminAggregate.js`:

```js
/* Pure aggregation of admin-overview data. No I/O — unit-tested. */

const blankUser = (id) => ({
  id, email: "", joinedAt: null, lastActiveAt: null,
  trips: { total: 0, ai: 0, manual: 0, unknown: 0 },
  aiUses: 0, tokens: { total: 0, thisWeek: 0 }, maps: [],
});

const ts = (v) => Date.parse(v || "") || 0;

function aggregateOverview({ users = [], trips = [], generations = [], weekStartMs = 0 } = {}) {
  const byId = new Map();
  const ensure = (id) => { if (!byId.has(id)) byId.set(id, blankUser(id)); return byId.get(id); };

  for (const u of users) {
    const r = ensure(u.id);
    r.email = (u.email || "").toLowerCase();
    r.joinedAt = u.created_at || null;
    r.lastActiveAt = u.last_sign_in_at || null;
  }

  for (const t of trips) {
    const r = ensure(t.owner_id);
    r.trips.total++;
    const bucket = t.source === "ai" ? "ai" : t.source === "wizard" ? "manual" : "unknown";
    r.trips[bucket]++;
    r.maps.push({
      id: t.id, title: t.title || "(ללא שם)",
      source: t.source || null, public: !!t.is_public, lastEdited: t.last_edited || null,
    });
    if (ts(t.last_edited) > ts(r.lastActiveAt)) r.lastActiveAt = t.last_edited;
  }

  for (const g of generations) {
    const r = ensure(g.user_id);
    r.aiUses++;
    const tok = Number.isFinite(g.total_tokens) ? g.total_tokens : 0;
    r.tokens.total += tok;
    if (weekStartMs && ts(g.created_at) >= weekStartMs) r.tokens.thisWeek += tok;
  }

  const list = [...byId.values()].sort((a, b) => ts(b.lastActiveAt) - ts(a.lastActiveAt));

  const kpis = {
    users: list.length,
    activeThisWeek: list.filter((u) => ts(u.lastActiveAt) >= weekStartMs).length,
    trips: trips.length,
    aiUses: generations.length,
    tokensTotal: list.reduce((n, u) => n + u.tokens.total, 0),
    tokensThisWeek: list.reduce((n, u) => n + u.tokens.thisWeek, 0),
  };

  return { kpis, users: list };
}

module.exports = { aggregateOverview };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:api`
Expected: PASS — all aiUsage + adminAggregate tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/adminAggregate.js api/_lib/adminAggregate.test.js
git commit -m "feat(admin): overview aggregation helper"
```

---

### Task 6: `/api/admin/overview` endpoint

**Files:**
- Create: `api/admin/overview.js`

**Interfaces:**
- Consumes: `aggregateOverview` from Task 5.
- Produces: `GET /api/admin/overview` → `200 { kpis, users, warnings }` for admin; `403` non-admin; `503` if unconfigured. Consumed by Task 8.

- [ ] **Step 1: Write the endpoint**

Create `api/admin/overview.js`:

```js
/* GET /api/admin/overview — admin-only, view-only aggregate of all users.
   The caller is verified as an admin from their Supabase token BEFORE any
   service-role read. The service_role key never leaves the server. */

const { aggregateOverview } = require("../_lib/adminAggregate");

const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPA_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "yoav.pintel@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/* Identify the caller from their own Supabase access token (anon key). */
const getUser = async (token) => {
  if (!SUPA_URL || !SUPA_ANON || !token) return null;
  try {
    const r = await fetch(SUPA_URL + "/auth/v1/user", {
      headers: { apikey: SUPA_ANON, authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: (u.email || "").toLowerCase() } : null;
  } catch { return null; }
};

/* Service-role read (bypasses RLS). Used ONLY after the admin check. */
const svc = (path) =>
  fetch(SUPA_URL + path, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });

/* Sunday 00:00 UTC — same window as the AI weekly quota. */
const weekStartMs = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
};

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method-not-allowed" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || null;
  const user = await getUser(token);
  if (!user || !ADMIN_EMAILS.includes(user.email)) return res.status(403).json({ error: "forbidden" });

  if (!SUPA_URL || !SERVICE_KEY) return res.status(503).json({ error: "not-configured", message: "Set SUPABASE_SERVICE_ROLE_KEY." });

  const warnings = [];
  const safe = async (label, fn, fallback) => {
    try { return await fn(); } catch (e) { warnings.push(`${label}: ${String(e && e.message || e)}`); return fallback; }
  };

  const users = await safe("users", async () => {
    const r = await svc("/auth/v1/admin/users?per_page=1000");
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.users || []);
    return arr.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
  }, []);

  const trips = await safe("trips", async () => {
    const r = await svc("/rest/v1/trips?select=id,title,owner_id,source,is_public,last_edited");
    return await r.json();
  }, []);

  const generations = await safe("generations", async () => {
    const r = await svc("/rest/v1/ai_generations?select=user_id,total_tokens,created_at");
    return await r.json();
  }, []);

  const payload = aggregateOverview({ users, trips, generations, weekStartMs: weekStartMs() });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ...payload, warnings });
}

module.exports = handler;
module.exports.config = { runtime: "nodejs" };
```

- [ ] **Step 2: Verify locally with the dev server (negative gate)**

Start the app (`npm start`) in another terminal if not running, then with no auth header:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/overview
```
Expected: `403` (no token ⇒ not admin). *(Note: `react-scripts` does not run `/api` functions; if the local server returns 404 for `/api/*`, verify on a Vercel preview deploy instead — the real gate check is Step 3 on prod.)*

- [ ] **Step 3: Commit**

```bash
git add api/admin/overview.js
git commit -m "feat(admin): /api/admin/overview endpoint (admin-gated, service-role)"
```

---

### Task 7: `AdminRoute` wrapper + `/admin` route

**Files:**
- Create: `src/components/AdminRoute.jsx`
- Modify: `src/App.jsx` (imports + a new `<Route path="/admin">`)

**Interfaces:**
- Consumes: `ProtectedRoute` (auth + initializing splash), `useAuth().user`, `isAdminEmail`.
- Produces: `/admin` route that renders `AdminView` (Task 8) only for the admin; non-admins → `/dashboard`.

- [ ] **Step 1: Create the wrapper**

Create `src/components/AdminRoute.jsx`:

```jsx
import React from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import isAdminEmail from "../utils/isAdmin";

/* AdminRoute — layers an admin-email check on top of ProtectedRoute.
   ProtectedRoute handles the auth splash + bounce-to-/auth; here we ensure
   ONLY the admin (yoav.pintel@gmail.com) proceeds. Any other signed-in user
   is redirected to /dashboard. This client gate is UX only — the real gate is
   the /api/admin/* endpoint returning 403. */
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {isAdminEmail(user?.email) ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
};

export default AdminRoute;
```

- [ ] **Step 2: Wire the route in `src/App.jsx`**

Add the imports (near the other view/route imports):
```jsx
import AdminRoute from "./components/AdminRoute";
import AdminView from "./views/AdminView";
```

Add the route inside `<Routes>` (place it just before the `/settings` route):
```jsx
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminView />
            </AdminRoute>
          }
        />
```

- [ ] **Step 3: Build to verify it compiles**

Run: `CI= npm run build`
Expected: build completes. (`AdminView` is created in Task 8 — do Task 8 before running this build, or temporarily stub the import. Recommended: implement Task 8 first, then run this build.)

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminRoute.jsx src/App.jsx
git commit -m "feat(admin): AdminRoute wrapper + /admin route"
```

---

### Task 8: `AdminView` UI

**Files:**
- Create: `src/views/AdminView.jsx`

**Interfaces:**
- Consumes: `GET /api/admin/overview` (Task 6), `supabase.auth.getSession()` for the token, `useDarkMode().P` palette.
- Produces: the rendered admin screen (KPI strip + users table + detail drawer).

- [ ] **Step 1: Create the view**

Create `src/views/AdminView.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../utils/theme";

const FONT = "'Noto Sans Hebrew','Inter',system-ui,sans-serif";
const nf = (n) => new Intl.NumberFormat("he-IL").format(Number.isFinite(n) ? n : 0);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("he-IL") : "—");

const AdminView = () => {
  const navigate = useNavigate();
  const { P } = useDarkMode();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [sortKey, setSortKey] = useState("lastActiveAt");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error("no-session");
        const res = await fetch("/api/admin/overview", { headers: { authorization: `Bearer ${token}` } });
        if (res.status === 403) throw new Error("אין הרשאה לצפות בעמוד זה.");
        if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
        const json = await res.json();
        if (live) setState({ loading: false, error: null, data: json });
      } catch (e) {
        if (live) setState({ loading: false, error: String(e.message || e), data: null });
      }
    })();
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => {
    const users = state.data?.users || [];
    const filtered = q ? users.filter((u) => (u.email || "").includes(q.toLowerCase())) : users;
    const val = (u) => {
      switch (sortKey) {
        case "trips": return u.trips.total;
        case "aiUses": return u.aiUses;
        case "tokens": return u.tokens.total;
        case "joinedAt": return Date.parse(u.joinedAt || "") || 0;
        default: return Date.parse(u.lastActiveAt || "") || 0;
      }
    };
    return [...filtered].sort((a, b) => val(b) - val(a));
  }, [state.data, q, sortKey]);

  if (state.loading) {
    return <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: FONT, color: P.ink3 }}>טוען נתונים…</div>;
  }
  if (state.error) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 12, fontFamily: FONT, color: P.ink }}>
        <div style={{ fontWeight: 800 }}>{state.error}</div>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, cursor: "pointer", fontFamily: FONT, color: P.ink }}>חזרה לדשבורד</button>
      </div>
    );
  }

  const k = state.data.kpis;
  const kpiTiles = [
    { label: "משתמשים", value: k.users },
    { label: "פעילים השבוע", value: k.activeThisWeek },
    { label: "מסלולים", value: k.trips },
    { label: "שימושי AI", value: k.aiUses },
    { label: "טוקנים סה\"כ", value: k.tokensTotal },
    { label: "טוקנים השבוע", value: k.tokensThisWeek },
  ];
  const cols = [
    { key: "lastActiveAt", label: "פעילות אחרונה" },
    { key: "joinedAt", label: "הצטרפות" },
    { key: "trips", label: "מסלולים" },
    { key: "aiUses", label: "שימושי AI" },
    { key: "tokens", label: "טוקנים" },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.surface, fontFamily: FONT, color: P.ink, padding: "20px clamp(12px,4vw,32px) 64px", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>ניהול משתמשים</h1>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, cursor: "pointer", fontFamily: FONT, color: P.ink, fontWeight: 700, fontSize: 13 }}>← דשבורד</button>
      </header>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 22 }}>
        {kpiTiles.map((t) => (
          <div key={t.label} style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: P.ink3, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{nf(t.value)}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי אימייל…"
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, fontFamily: FONT, fontSize: 14, marginBottom: 12 }} />

      {/* Users table */}
      <div style={{ overflowX: "auto", border: `1px solid ${P.line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "right", padding: "10px 12px", color: P.ink3, fontWeight: 700, borderBottom: `1px solid ${P.line}` }}>אימייל</th>
              {cols.map((c) => (
                <th key={c.key} onClick={() => setSortKey(c.key)} title="מיון"
                  style={{ textAlign: "right", padding: "10px 12px", color: sortKey === c.key ? "#E0533F" : P.ink3, fontWeight: 700, borderBottom: `1px solid ${P.line}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {c.label}{sortKey === c.key ? " ↓" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: P.ink3 }}>אין משתמשים להצגה</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setSelected(u)} style={{ cursor: "pointer" }}>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, direction: "ltr", textAlign: "right" }}>{u.email || u.id}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}` }}>{fmtDate(u.lastActiveAt)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}` }}>{fmtDate(u.joinedAt)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.trips.total)} <span style={{ color: P.ink4, fontSize: 11 }}>({nf(u.trips.ai)} AI · {nf(u.trips.manual)} ידני)</span></td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.aiUses)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.tokens.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.35)" }}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: "min(440px,92%)", background: P.panel, boxShadow: "8px 0 40px rgba(0,0,0,0.2)", padding: "20px", overflowY: "auto", fontFamily: FONT }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ direction: "ltr", fontWeight: 800, fontSize: 15 }}>{selected.email || selected.id}</div>
              <button onClick={() => setSelected(null)} aria-label="סגירה" style={{ border: "none", background: P.surface, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: P.ink2, fontFamily: FONT }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5, color: P.ink2 }}>
              <span>הצטרף: {fmtDate(selected.joinedAt)}</span>·<span>שימושי AI: {nf(selected.aiUses)}</span>·<span>טוקנים: {nf(selected.tokens.total)}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>המפות ({selected.maps.length})</div>
            {selected.maps.length === 0 && <div style={{ color: P.ink3, fontSize: 13 }}>אין מפות.</div>}
            {selected.maps.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${P.line}` }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", background: P.surface, color: m.source === "ai" ? "#E0533F" : P.ink3 }}>
                  {m.source === "ai" ? "AI" : m.source === "wizard" ? "ידני" : "לא ידוע"}{m.public ? " · ציבורי" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
```

- [ ] **Step 2: Build to verify it compiles**

Run: `CI= npm run build`
Expected: build completes with no errors. (Palette tokens used — `P.surface`, `P.panel`, `P.ink`, `P.ink2`, `P.ink3`, `P.ink4`, `P.line` — are all confirmed present in `src/utils/theme.js`.)

- [ ] **Step 3: Commit**

```bash
git add src/views/AdminView.jsx
git commit -m "feat(admin): AdminView — KPIs, users table, detail drawer"
```

---

### Task 9: Admin-only side-menu entry

**Files:**
- Modify: `src/components/SideMenu.jsx` (imports + the authenticated nav block near line 82-86)

**Interfaces:**
- Consumes: `useAuth().user`, `isAdminEmail`.
- Produces: a "ניהול (אדמין)" item that navigates to `/admin`, rendered ONLY for the admin.

- [ ] **Step 1: Import the admin check**

At the top of `src/components/SideMenu.jsx`, add:
```jsx
import isAdminEmail from "../utils/isAdmin";
```

- [ ] **Step 2: Add the gated item**

In the authenticated block (the `isAuthenticated ? ( <> ... </> )` group containing the existing `<Item ... "הגדרות וניהול" .../>`), add — right after the settings item:
```jsx
              {isAdminEmail(user?.email) && (
                <Item icon="shield" label="ניהול (אדמין)" onClick={() => go("/admin")} />
              )}
```
(The `shield` icon is confirmed present in `src/components/Icon.jsx`; `users` is also available if preferred.)

- [ ] **Step 3: Build to verify it compiles**

Run: `CI= npm run build`
Expected: build completes.

- [ ] **Step 4: Manual gate check (both directions)**

Run `npm start`, sign in as `yoav.pintel@gmail.com` → open the side menu → "ניהול (אדמין)" is present and navigates to `/admin`. Sign in as any other account (or as guest) → the item is ABSENT, and manually visiting `/admin` redirects to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SideMenu.jsx
git commit -m "feat(admin): admin-only side-menu entry to /admin"
```

---

### Task 10: Critical-check for the admin gate + full gate

**Files:**
- Modify: `scripts/critical-checks.js` (add one check)

**Interfaces:**
- Consumes: `api/admin/overview.js` (Task 6).
- Produces: a static invariant that the admin endpoint verifies admin before a service-role read.

- [ ] **Step 1: Add the critical check**

In `scripts/critical-checks.js`, before the `── SUMMARY ──` section, add:

```js
/* ── ADMIN — the overview endpoint must gate on admin BEFORE any
   service-role read (never leak all users to a non-admin). ────────────── */
const adminApi = read("api/admin/overview.js");
check(
  "ADMIN: /api/admin/overview returns 403 for non-admins before any service-role read",
  /ADMIN_EMAILS\.includes\(user\.email\)\)\s*return res\.status\(403\)/.test(adminApi) &&
    adminApi.indexOf("status(403)") < adminApi.indexOf('svc("/'),
  "overview.js must check ADMIN_EMAILS.includes(user.email) and return 403 BEFORE the first service-role read (svc(\"/...\"))."
);
```

- [ ] **Step 2: Run the critical gate**

Run: `npm run critical`
Expected: `✅ All 9 critical checks passed — safe to deploy.` (8 existing + the new admin check).

- [ ] **Step 3: Run the API tests + build**

Run: `npm run test:api`
Expected: PASS (aiUsage + adminAggregate).
Run: `CI= npm run build`
Expected: build completes.

- [ ] **Step 4: Commit**

```bash
git add scripts/critical-checks.js
git commit -m "feat(admin): critical-check — admin endpoint gates before service-role read"
```

---

## Post-implementation (before public launch)

- Confirm `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAILS` are set in the Vercel project env.
- Deploy (mock-env dance) and verify on prod:
  - As admin: `/admin` shows KPIs + table; a user row opens the maps list.
  - Non-admin token → `GET /api/admin/overview` returns `403` (test with a second account's token, or no token).
  - A fresh AI generation writes a `total_tokens` value on its `ai_generations` row.
- Run the launch QA doc's §1 (auth), §11 (sharing), and this admin gate before going live.
