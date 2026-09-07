/* ══════════════════════════════════════════════════════════════
   startTripLink.js — THE single "start a trip with this place
   pre-chosen" resolver.

   This mechanism was implemented inline in `SiteFooter.jsx` and is
   now used by the landing hero field, the hero chips, the closing
   field and the footer. Per DESIGN.md's single-resolver rule (the
   `mapsUrl.js` precedent), there is exactly ONE implementation.
   Do not inline a second copy.

   The auth branch is load-bearing and subtle: `ProtectedRoute`
   drops the query string, so a guest must be routed through
   `/auth` with the full target in `state.from`, which `AuthView`
   honours. That is what preserves `?dest=&city=` across login.
   ══════════════════════════════════════════════════════════════ */

/* `/create?dest=<countryId>[&city=<name>]`.
   A country pick passes no city; a city pick passes both. */
export const buildStartTripTarget = ({ dest, city } = {}) => {
  if (!dest) return "/create";
  const base = `/create?dest=${encodeURIComponent(dest)}`;
  const name = typeof city === "string" ? city.trim() : "";
  return name ? `${base}&city=${encodeURIComponent(name)}` : base;
};

/* Navigate there, sending guests through login first WITHOUT losing
   the query. Returns the target so callers can assert on it. */
export const startTrip = (choice, { isAuthenticated, navigate } = {}) => {
  const target = buildStartTripTarget(choice);
  if (typeof navigate !== "function") return target;
  if (isAuthenticated) navigate(target);
  else navigate("/auth", { state: { from: target } });
  return target;
};
