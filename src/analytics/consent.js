/* Cookie / analytics consent state — the single source of truth for whether the
   user has agreed to product analytics (PostHog).

   Split rationale (documented for future me):
   • Vercel Web Analytics is cookieless + anonymous (no cross-site identifier,
     no personal data) → treated as "essential" traffic measurement, always on.
   • PostHog sets cookies + can identify a person → gated behind explicit
     consent here. initAnalytics() checks getConsent() before starting PostHog.

   Stored in localStorage so the choice persists and survives reloads. */
const KEY = "tp_cookie_consent_v1";

/* "accepted" | "declined" | null (not yet decided). */
export function getConsent() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setConsent(value) {
  try { localStorage.setItem(KEY, value); } catch { /* storage blocked — session-only */ }
}

export const hasDecided = () => {
  const v = getConsent();
  return v === "accepted" || v === "declined";
};

export const analyticsAllowed = () => getConsent() === "accepted";
