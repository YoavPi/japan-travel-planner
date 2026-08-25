/* ══════════════════════════════════════════════════════════════════════
   /api/ai-errors-digest — a SMALL, token-protected read-only summary of the
   `ai_errors` table for the daily monitoring agent.

   The daily scheduled agent curls:
     GET /api/ai-errors-digest?token=<ADMIN_DIGEST_TOKEN>[&hours=24]
   and reports the JSON summary. The Supabase SERVICE-ROLE key stays server-side
   (never in the agent), so the agent only holds a low-privilege digest token.

   Env (Vercel → Settings → Environment Variables):
     • ADMIN_DIGEST_TOKEN          — a random secret; the agent must send it.
     • SUPABASE_SERVICE_ROLE_KEY   — Supabase service-role key (reads ai_errors,
                                     which has NO end-user SELECT policy).
     • REACT_APP_SUPABASE_URL      — the Supabase project URL (already set).
   ══════════════════════════════════════════════════════════════════════ */

const config = { maxDuration: 30 };

const SUPA_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DIGEST_TOKEN = process.env.ADMIN_DIGEST_TOKEN || "";

/* Bucket a raw error message into a human category (Hebrew) for the summary. */
const categorize = (msg = "") => {
  const m = String(msg).toLowerCase();
  if (/429|quota|too many|exceeded|overload/.test(m)) return "עומס/מכסת Gemini";
  if (/no-verified-places|could not be verified/.test(m)) return "מקום לא אומת ב-Places";
  if (/unparseable|ארוך מדי|max_?tokens|truncat/.test(m)) return "פלט LLM לא תקין";
  if (/places|maps|geocode|403|404/.test(m)) return "Google Places";
  if (/timeout|network|fetch failed|econn/.test(m)) return "רשת / timeout";
  return "אחר";
};

const readToken = (req) => {
  if (req.query && req.query.token) return String(req.query.token);
  try { return new URL(req.url, "http://x").searchParams.get("token") || ""; }
  catch { return ""; }
};
const readHours = (req) => {
  const raw = (req.query && req.query.hours) || (() => { try { return new URL(req.url, "http://x").searchParams.get("hours"); } catch { return null; } })();
  return Math.min(168, Math.max(1, Number(raw) || 24));
};

async function handler(req, res) {
  if (!DIGEST_TOKEN || readToken(req) !== DIGEST_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!SUPA_URL || !SERVICE_KEY) {
    return res.status(503).json({ error: "not-configured", message: "Set SUPABASE_SERVICE_ROLE_KEY (and REACT_APP_SUPABASE_URL)." });
  }
  const hours = readHours(req);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/ai_errors?created_at=gte.${since}&select=message,context,created_at&order=created_at.desc`,
      { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
    if (!r.ok) return res.status(502).json({ error: "query-failed", status: r.status });
    const rows = await r.json();
    const byCategory = {};
    (rows || []).forEach((e) => { const c = categorize(e.message || ""); byCategory[c] = (byCategory[c] || 0) + 1; });
    return res.status(200).json({
      windowHours: hours,
      since,
      total: (rows || []).length,
      byCategory,
      sample: (rows || []).slice(0, 6).map((e) => ({
        message: String(e.message || "").slice(0, 140),
        destination: (e.context && e.context.destination) || null,
        at: e.created_at,
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: "digest-failed", message: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.config = config;
