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
