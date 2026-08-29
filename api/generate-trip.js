/* ══════════════════════════════════════════════════════════════════════
   /api/generate-trip — Vercel Serverless Function (Node.js runtime).

   INITIATIVE 01 · AI trip generation. Server-side ONLY — the LLM key and
   the server Places key never touch the client bundle.

   Pipeline:
     1. Receive { destination, dayCount, pace, preferences, transport }.
     2. Ask an LLM (Anthropic Claude) for a day-partitioned list of REAL
        places (JSON only), sized to the requested pace.
     3. Verify EVERY place against Google Places Text Search — keep only
        places that resolve to a real listing (hallucination guard).
     4. Order each day's verified places by nearest-neighbour (haversine)
        so the route has no needless backtracking.
     5. Return a normalized { days:[{ dayNumber, city, spots:[…] }], meta }.
        The client maps this into the app's tripData schema.

   Env (set in Vercel → Project → Settings → Environment Variables):
     • GEMINI_API_KEY           — Google Gemini key (preferred). If absent,
                                  LLM_API_KEY (Anthropic) is used instead.
     • GEMINI_MODEL / LLM_MODEL — optional model overrides (defaults:
                                  "gemini-2.0-flash" / "claude-sonnet-5").
     • GOOGLE_PLACES_SERVER_KEY — Google key with Places API enabled and NO
                                  HTTP-referrer restriction (required for the
                                  server-side Text Search). Falls back to
                                  REACT_APP_GOOGLE_MAPS_API_KEY, which usually
                                  fails server-side because it is referrer-locked.
   ══════════════════════════════════════════════════════════════════════ */

const config = { maxDuration: 60 };

/* LLM provider — Gemini when GEMINI_API_KEY is set (preferred), else Anthropic
   via LLM_API_KEY. Model overridable with GEMINI_MODEL / LLM_MODEL. */
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ANTHROPIC_KEY = process.env.LLM_API_KEY || "";
const ANTHROPIC_MODEL = process.env.LLM_MODEL || "claude-sonnet-5";
const HAS_LLM = !!(GEMINI_KEY || ANTHROPIC_KEY);
const LLM_LABEL = GEMINI_KEY ? GEMINI_MODEL : ANTHROPIC_MODEL;

const PLACES_KEY = process.env.GOOGLE_PLACES_SERVER_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

/* Cost controls (Supabase-backed). Both degrade gracefully — if Supabase env
   is missing or a call fails, generation still works (Google Cloud quotas are
   the hard backstop). */
const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPA_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
/* Rate limiting — WEEKLY per-user cap + a min gap between requests (cost guard
   until paid subscriptions exist). Overridable via env. */
const WEEKLY_LIMIT = Number(process.env.AI_WEEKLY_LIMIT || 3); // trips/user/week
const COOLDOWN_MS = Number(process.env.AI_COOLDOWN_MS || 120000); // 2 min between requests
/* Place cache freshness — a cached place identity is reused for 6 months, then
   refreshed from Google on the next lookup. */
const CACHE_TTL_MS = Number(process.env.PLACE_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 183); // ~6 months
const crypto = require("crypto");
const { usageFromGemini, generationRow } = require("./_lib/aiUsage");

/* Hard cap: 3–4 real places per day keeps the LLM output small (no truncation)
   AND minimises paid Google Places lookups. relaxed→3, otherwise→4. */
const PACE_SPOTS = { relaxed: 3, balanced: 4, intense: 4 };
const MAX_DAYS = 14;
const MAX_SPOTS_PER_DAY = 4;

/* ── helpers ─────────────────────────────────────────────────────────── */

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
};

/* Haversine distance in km between two {lat,lng}. */
const haversineKm = (a, b) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/* Greedy nearest-neighbour ordering, starting from the first spot. */
const orderByProximity = (spots) => {
  if (spots.length <= 2) return spots;
  const remaining = spots.slice();
  const ordered = [remaining.shift()];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last, remaining[i]);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    ordered.push(remaining.splice(bestI, 1)[0]);
  }
  return ordered;
};

/* Run async tasks with bounded concurrency (keeps us well under the
   function's time budget without hammering the Places API). */
const mapWithConcurrency = async (items, limit, fn) => {
  const out = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

/* ── Supabase REST helpers (cost controls) ───────────────────────────── */

const supaFetch = (path, { token, method = "GET", body, headers = {} } = {}) =>
  fetch(SUPA_URL + path, {
    method,
    headers: {
      apikey: SUPA_ANON,
      authorization: `Bearer ${token || SUPA_ANON}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

/* Admins bypass the weekly cap + cooldown (still counted). Configurable via
   ADMIN_EMAILS (comma-separated); defaults to the owner. */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "yoav.pintel@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/* Verify + identify the caller from their Supabase access token. */
const getUser = async (token) => {
  if (!SUPA_URL || !SUPA_ANON || !token) return null;
  try {
    const r = await supaFetch("/auth/v1/user", { token });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: (u.email || "").toLowerCase() } : null;
  } catch { return null; }
};

/* Start of the current week (Sunday 00:00 UTC) — the weekly quota window. */
const weekStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d;
};
/* When the weekly quota resets (next Sunday 00:00 UTC). */
const weekResetsAt = () => { const d = weekStart(); d.setUTCDate(d.getUTCDate() + 7); return d; };

/* Trips this user has generated since the start of this week. */
const countThisWeek = async (userId, token) => {
  try {
    const r = await supaFetch(
      `/rest/v1/ai_generations?user_id=eq.${userId}&created_at=gte.${weekStart().toISOString()}&select=id`,
      { token, headers: { Prefer: "count=exact" } });
    const cr = r.headers.get("content-range") || "";
    const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
    if (Number.isFinite(total)) return total;
    const rows = await r.json();
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
};

/* Timestamp (ms) of this user's most recent generation — for the cooldown gap. */
const lastGenerationAt = async (userId, token) => {
  try {
    const r = await supaFetch(
      `/rest/v1/ai_generations?user_id=eq.${userId}&select=created_at&order=created_at.desc&limit=1`,
      { token });
    if (!r.ok) return 0;
    const rows = await r.json();
    const ts = Array.isArray(rows) && rows[0] ? Date.parse(rows[0].created_at) : NaN;
    return Number.isFinite(ts) ? ts : 0;
  } catch { return 0; }
};

const recordGeneration = async (userId, token, meta = {}) => {
  try {
    await supaFetch("/rest/v1/ai_generations", {
      token, method: "POST",
      body: generationRow(userId, meta),
      headers: { Prefer: "return=minimal" },
    });
  } catch { /* best-effort */ }
};

/* Log a generation FAILURE for our own daily review — the user only ever sees a
   calm generic message, but we keep the real reason. Goes to the Vercel function
   logs (always) AND, best-effort, an `ai_errors` table (durable). */
const logError = async (info, token) => {
  try { console.error("[ai-generate] failure", JSON.stringify(info)); } catch { /* noop */ }
  if (!SUPA_URL || !SUPA_ANON) return;
  try {
    await supaFetch("/rest/v1/ai_errors", {
      token, method: "POST",
      body: {
        user_id: info.userId || null,
        message: String(info.message || "").slice(0, 500),
        context: { destination: info.destination || null, dayCount: info.dayCount || null, stage: info.stage || null },
      },
      headers: { Prefer: "return=minimal" },
    });
  } catch { /* best-effort — never block the response on logging */ }
};

/* Shared Places verification cache — the expensive Text Search call is skipped
   when a search query was already resolved (by anyone). Keyed by a hash of the
   normalized query; stores only the neutral place identity (not trip notes). */
const cacheKey = (q) => crypto.createHash("sha1").update(q.trim().toLowerCase()).digest("hex");

/* Returns { place, fresh } or null. `fresh` = updated within CACHE_TTL_MS
   (6 months) → reuse as-is (0 Google calls). Stale rows are refreshed by the
   caller. `updated_at` falls back to a timestamp stored inside the payload for
   rows created before the column existed. */
const cacheGet = async (q, token) => {
  if (!SUPA_URL || !SUPA_ANON) return null;
  try {
    const r = await supaFetch(`/rest/v1/place_cache?q=eq.${cacheKey(q)}&select=payload,updated_at`, { token });
    if (!r.ok) return null;
    const rows = await r.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row || !row.payload) return null;
    const ts = Date.parse(row.updated_at || row.payload.cached_at || "");
    const fresh = Number.isFinite(ts) && (Date.now() - ts) < CACHE_TTL_MS;
    return { place: row.payload, fresh };
  } catch { return null; }
};

const cacheSet = async (q, place, token) => {
  if (!SUPA_URL || !SUPA_ANON) return;
  const now = new Date().toISOString();
  const payload = { ...place, cached_at: now }; // cached_at = fallback freshness marker
  try { await supaFetch("/rest/v1/place_cache", { token, method: "POST", body: { q: cacheKey(q), payload, updated_at: now }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }); }
  catch { /* best-effort */ }
};

/* Pull the first JSON object out of an LLM reply, tolerating ```json fences
   or leading prose. Returns null on anything unparseable. */
const extractJson = (text) => {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); }
  catch { return null; }
};

/* Salvage a TRUNCATED JSON object (Gemini hit the token limit mid-structure):
   keep everything up to the last fully-closed element, then close the still-open
   brackets so it parses. Turns a hard failure into the days that DID complete. */
const salvageJson = (raw) => {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  if (start === -1) return null;
  const s = body.slice(start);
  let inStr = false, esc = false, safeEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "}" || ch === "]") safeEnd = i + 1; // a complete element just closed here
  }
  if (safeEnd === -1) return null;
  let out = s.slice(0, safeEnd).replace(/,\s*$/, "");
  // Recount open brackets on the truncated prefix and close them in order.
  inStr = false; esc = false; const stack = [];
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  while (stack.length) out += stack.pop();
  try { return JSON.parse(out); } catch { return null; }
};

/* ── the LLM step ────────────────────────────────────────────────────── */

const TRANSPORT_LABEL = { walking: "walking", transit: "public transit", car: "car" };

const buildPrompt = ({ destination, dayCount, spotsPerDay, preferences, transport, instructions, party, restrictions, refine, previous }) => {
  const prefText = Array.isArray(preferences) ? preferences.join(", ") : String(preferences || "");
  const modes = (Array.isArray(transport) ? transport : [transport]).filter(Boolean).map((m) => TRANSPORT_LABEL[m] || m);
  const transportHint = modes.length
    ? `The traveller moves by: ${modes.join(" + ")}. Cluster each day so travel between spots suits those modes (tighter for walking).`
    : "Keep each day's spots reasonably compact.";
  const restrictText = Array.isArray(restrictions) ? restrictions.filter(Boolean).join(", ") : String(restrictions || "");
  const partyText = party && (party.adults || party.kids)
    ? `${party.adults || 0} adults${party.kids ? ` and ${party.kids} children` : ""}` : null;
  const system =
    "You are an expert local travel planner. You output ONLY valid minified JSON — no prose, no markdown, no code fences. " +
    "Schema exactly: {\"description\":\"<a warm 1-2 sentence Hebrew summary of the whole trip>\",\"days\":[{\"dayNumber\":<int>,\"city\":\"<city in English>\",\"title\":\"<a 2-4 word Hebrew theme for the day>\",\"spots\":[{\"name\":\"<the exact, official place name in English>\",\"category\":\"<one Hebrew word: אטרקציה|מסעדה|קפה|קניות|טבע|מוזיאון|מלון>\",\"note\":\"<a SHORT Hebrew tip, max 8 words — hint when it is OPEN or the BEST time to go when relevant>\",\"crowd\":\"<high|medium|none>\"}]}]}. " +
    "Rules: (1) Produce EXACTLY the requested number of days. (2) Each day has EXACTLY the requested spots-per-day — never more than 4 places in a day. " +
    "(3) Every place MUST be a REAL, well-known, currently-operating place in the destination — never invent names. " +
    "(4) Use each place's exact official English name so Google Maps finds it precisely (the day's city is provided separately). " +
    "(5) Cluster each day's spots geographically to minimise travel. (6) Reflect the traveller's interests, party composition, dietary/accessibility restrictions AND any custom instructions. (7) No duplicate places across the whole trip. " +
    "(8) Do NOT place an attraction on a day it is typically CLOSED (use your knowledge of common closing days, e.g. many museums close Mondays). " +
    "(9) Mark crowd-magnet places with crowd:\"high\", and ORDER each day so busy places fall at their least-crowded time (famous sights early morning, dinners in the evening); add a short best-time hint to their note." +
    (refine ? " (10) You are REVISING an existing itinerary: keep it mostly the same and apply ONLY the requested change, returning the FULL updated plan." : "");
  const user = JSON.stringify({
    destination,
    days: dayCount,
    spotsPerDay,
    interests: prefText || "a well-rounded mix",
    transportNote: transportHint,
    party: partyText,
    restrictions: restrictText || null,
    customInstructions: (instructions || "").trim() || null,
    ...(refine ? { revise: { instruction: refine, currentPlan: previous || null } } : {}),
  });
  return { system, user };
};

const callGemini = async (system, user) => {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(GEMINI_MODEL) + ":generateContent?key=" + GEMINI_KEY;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 12288, responseMimeType: "application/json" },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Gemini request failed (${resp.status}): ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  const cand = data.candidates && data.candidates[0];
  const parts = cand && cand.content && cand.content.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";
  /* Truncated output = JSON cut off mid-structure. Report it so callLLM can try
     to salvage the completed days before giving up. */
  const usage = usageFromGemini(data);
  return { text, truncated: !!cand && cand.finishReason === "MAX_TOKENS", usage };
};

const callAnthropic = async (system, user) => {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 4096, system, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`LLM request failed (${resp.status}): ${detail.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = Array.isArray(data.content) ? data.content.map((b) => b.text || "").join("") : "";
  return { text, truncated: data.stop_reason === "max_tokens" };
};

const callLLM = async (payload) => {
  const { system, user } = buildPrompt(payload);
  // Up to 2 attempts: the model occasionally returns an empty/blocked or
  // truncated candidate. Each attempt: normal parse → salvage the completed
  // days → retry. A salvaged plan may have fewer days than asked, which still
  // beats a hard error.
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
      return parsed; // { description?, days: [{ dayNumber, city, title?, spots }], usage }
    }
    // Only retry a cheap, essentially-EMPTY/blocked response (fast). A long
    // truncated reply that salvaged nothing is expensive to re-run and would
    // risk the 60s function limit — fail friendly instead of retrying it.
    if ((call.text || "").length > 400) break;
  }
  if (lastTruncated) throw new Error("המסלול שביקשתם ארוך מדי לעיבוד בבת אחת. נסו פחות ימים או קצב רגוע יותר.");
  throw new Error("לא הצלחנו לבנות מסלול הפעם. נסו שוב או שנו מעט את היעד/ההעדפות.");
};

/* ── the Places verification step ────────────────────────────────────── */

/* Places API (New) — a SINGLE searchText call with a field mask so we only pay
   for (and receive) exactly id, location, displayName & photos. Field masking
   keeps us on the cheaper SKU and returns the photo reference in the SAME call
   (no extra Place-Details round-trip). If the New API isn't enabled on the key,
   we remember that and fall back to the proven legacy Text Search. */
let placesNewDisabled = false;

const placesSearchNew = async (query) => {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.location,places.displayName,places.photos",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: "he" }),
  });
  if (r.status === 403 || r.status === 404) { placesNewDisabled = true; const e = new Error("places-new-unavailable"); e.fallback = true; throw e; }
  if (!r.ok) throw new Error(`places-new ${r.status}`);
  const j = await r.json();
  const p = j.places && j.places[0];
  if (!p || !p.location || !Number.isFinite(p.location.latitude)) return null;
  return {
    name: (p.displayName && p.displayName.text) || query,
    place_id: p.id,
    address: "",
    lat: p.location.latitude,
    lng: p.location.longitude,
    rating: null,
    // Photo RESOURCE NAME (New API). The client renders it sized (maxWidthPx=400)
    // via usePlacePhotos — no big images, no extra server call.
    photo_name: Array.isArray(p.photos) && p.photos[0] ? p.photos[0].name : null,
  };
};

const placesSearchLegacy = async (query) => {
  const url = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" + encodeURIComponent(query) + "&key=" + PLACES_KEY;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "OK" || !Array.isArray(j.results) || !j.results.length) return null;
  const p = j.results[0];
  const loc = p.geometry && p.geometry.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  return {
    name: p.name || query,
    place_id: p.place_id,
    address: p.formatted_address || "",
    lat: loc.lat,
    lng: loc.lng,
    rating: Number.isFinite(p.rating) ? p.rating : null,
    photo_name: null, // legacy: photos hydrate client-side from place_id as before
  };
};

const placesSearch = async (query) => {
  if (!placesNewDisabled) {
    try { return await placesSearchNew(query); }
    catch (e) { if (!e.fallback) throw e; /* New API unavailable → legacy */ }
  }
  return placesSearchLegacy(query);
};

const verifyPlace = async (spot, token, ctx = {}) => {
  /* Query built server-side (name + city + destination). name is the exact
     official English name; city/destination anchor it to the right place. */
  const region = spot.city || ctx.city || ctx.destination || "";
  const query = [String(spot.name || "").trim(), String(region).trim()].filter(Boolean).join(", ");
  if (!query) return null;
  const withSpot = (place) => place && ({
    ...place,
    category: spot.category || place.category || "אטרקציה",
    note: spot.note || "", // trip-specific — never cached
    crowd: /^(high|medium)$/i.test(spot.crowd || "") ? spot.crowd.toLowerCase() : null,
  });

  // 1️⃣ Cache lookup. FRESH hit (<6 months) → 0 Google calls.
  const cached = await cacheGet(query, token);
  if (cached && cached.fresh && cached.place && cached.place.place_id) return withSpot(cached.place);

  // 2️⃣ Miss OR stale (>6 months) → query Google, upsert (refresh), return.
  try {
    const place = await placesSearch(query);
    if (!place || !place.place_id) {
      // Nothing new — a stale copy still beats dropping the spot.
      return cached && cached.place && cached.place.place_id ? withSpot(cached.place) : null;
    }
    cacheSet(query, place, token); // fire-and-forget upsert (stamps updated_at)
    return withSpot(place);
  } catch {
    // Network/quota problem → fall back to any cached copy, else drop.
    return cached && cached.place && cached.place.place_id ? withSpot(cached.place) : null;
  }
};

/* ── handler ─────────────────────────────────────────────────────────── */

async function handler(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || null;

  // AUTH — generation is for signed-in users only (block guests). Also gates the
  // GET quota endpoint. Identified via the caller's Supabase access token.
  const user = await getUser(token);
  if (!user) {
    return res.status(401).json({ error: "auth-required", message: "יש להתחבר כדי לבנות מסלול עם AI." });
  }
  const userId = user.id;
  const isAdmin = ADMIN_EMAILS.includes(user.email); // unlimited, still counted

  // GET → the caller's current weekly quota (so the UI can show "X/10"), no work done.
  if (req.method === "GET") {
    const usedWeek = await countThisWeek(userId, token);
    return res.status(200).json({
      limit: isAdmin ? null : WEEKLY_LIMIT,
      used: usedWeek,
      remaining: isAdmin ? null : Math.max(0, WEEKLY_LIMIT - usedWeek),
      resetsAt: weekResetsAt().toISOString(),
      admin: isAdmin,
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!HAS_LLM) return res.status(503).json({ error: "missing-llm-key", message: "No LLM key configured (set GEMINI_API_KEY or LLM_API_KEY)." });
  if (!PLACES_KEY) return res.status(503).json({ error: "missing-places-key", message: "No server Google Places key configured." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const destination = String(body.destination || "").trim();
  if (!destination) return res.status(400).json({ error: "missing-destination" });
  const dayCount = clampInt(body.dayCount, 1, MAX_DAYS, 3);
  const spotsPerDay = clampInt(PACE_SPOTS[body.pace] || body.spotsPerDay, 2, MAX_SPOTS_PER_DAY, 4);

  // COOLDOWN + WEEKLY CAP — enforced for regular users; admins bypass both
  // (still counted). Cost stays bounded by the ₪50/mo Gemini spend cap.
  if (!isAdmin) {
    const last = await lastGenerationAt(userId, token);
    if (last && Date.now() - last < COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "cooldown", retryAfterSec, message: `רגע אחד — אפשר לבנות מסלול חדש כל ${Math.round(COOLDOWN_MS / 60000)} דקות. נסו שוב בעוד ${retryAfterSec} שניות.` });
    }
  }
  const usedWeek = await countThisWeek(userId, token);
  if (!isAdmin && usedWeek >= WEEKLY_LIMIT) {
    return res.status(429).json({
      error: "weekly-limit",
      limit: WEEKLY_LIMIT, used: usedWeek, remaining: 0,
      resetsAt: weekResetsAt().toISOString(),
      message: `הגעת למכסת המסלולים השבועית ב-AI (${WEEKLY_LIMIT}/${WEEKLY_LIMIT}). המכסה מתחדשת בתחילת השבוע הבא! בינתיים אפשר להמשיך להוסיף ולערוך מקומות ידנית.`,
    });
  }

  try {
    // 1–2. Ask the LLM for a day-partitioned draft (honoring instructions,
    //      transport modes, and any refine request).
    const draft = await callLLM({
      destination, dayCount, spotsPerDay,
      preferences: body.preferences, transport: body.transport,
      instructions: body.instructions,
      party: body.party || null,
      restrictions: body.restrictions || null,
      refine: (body.refine || "").trim() || null,
      previous: body.previous || null,
    });
    const draftDays = draft.days;

    // 3. Verify every spot against Google Places, in parallel, dropping
    //    anything that doesn't resolve (hallucination guard). We also
    //    de-duplicate by place_id across the whole trip.
    const seen = new Set();
    const outDays = [];
    for (const d of draftDays.slice(0, dayCount)) {
      const spots = Array.isArray(d.spots) ? d.spots.slice(0, MAX_SPOTS_PER_DAY) : [];
      const verified = (await mapWithConcurrency(spots, 6, (s) => verifyPlace(s, token, { city: d.city, destination })))
        .filter(Boolean)
        .filter((s) => { if (seen.has(s.place_id)) return false; seen.add(s.place_id); return true; });
      // 4. Order the day by proximity.
      const ordered = orderByProximity(verified);
      outDays.push({
        dayNumber: outDays.length + 1,
        city: d.city || destination,
        title: (d.title || "").trim() || null,
        spots: ordered,
      });
    }

    const keptCount = outDays.reduce((n, d) => n + d.spots.length, 0);
    if (keptCount === 0) {
      await logError({ userId, destination, dayCount, stage: "verify", message: "no-verified-places" }, token);
      return res.status(422).json({ error: "no-verified-places", message: "No suggested places could be verified on Google Places." });
    }

    // Count this successful generation against the user's weekly quota.
    await recordGeneration(userId, token, {
      usage: draft.usage,
      kind: (body.refine || "").trim() ? "refine" : "create",
    });

    return res.status(200).json({
      destination,
      dayCount: outDays.length,
      description: (draft.description || "").trim() || null,
      days: outDays,
      meta: {
        model: LLM_LABEL, verifiedSpots: keptCount,
        weeklyLimit: isAdmin ? null : WEEKLY_LIMIT,
        used: usedWeek + 1,
        remaining: isAdmin ? null : Math.max(0, WEEKLY_LIMIT - usedWeek - 1),
        resetsAt: weekResetsAt().toISOString(),
        admin: isAdmin,
      },
    });
  } catch (err) {
    await logError({ userId, destination, dayCount, stage: "generate", message: String(err && err.message || err) }, token);
    return res.status(502).json({ error: "generation-failed", message: String(err && err.message || err) });
  }
}

module.exports = handler;
module.exports.config = config;
