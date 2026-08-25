/* PostHog product analytics.
   Answers the "what do people DO" questions that Vercel Web Analytics can't:
   which CTAs/buttons get clicked (autocapture), how many maps get built
   (the `map_created` event), and where users drop off (funnels).

   INERT until REACT_APP_POSTHOG_KEY is set — so local dev, preview builds, and
   anyone who hasn't configured a key never send events. Nothing here throws if
   PostHog isn't configured; every export is a safe no-op in that case. */
import posthog from "posthog-js";
import { analyticsAllowed } from "./consent";

const KEY = process.env.REACT_APP_POSTHOG_KEY || "";
/* US cloud by default; set REACT_APP_POSTHOG_HOST to https://eu.i.posthog.com
   if the PostHog project was created in the EU region. */
const HOST = process.env.REACT_APP_POSTHOG_HOST || "https://us.i.posthog.com";

let ready = false;

export function initAnalytics() {
  if (ready || !KEY || typeof window === "undefined") return;
  /* Consent gate — PostHog only starts once the user has accepted (the cookie
     banner calls this again on accept). Declined / undecided → stays inert. */
  if (!analyticsAllowed()) return;
  posthog.init(KEY, {
    api_host: HOST,
    /* SPA pageviews: re-fire $pageview on every react-router navigation, not
       just the first load — otherwise the whole app looks like one page. */
    capture_pageview: "history_change",
    /* Every click/submit/change on the page, no per-button tagging — this is
       what powers the "most-clicked CTA / button" report. */
    autocapture: true,
    persistence: "localStorage+cookie",
    /* Only create a person profile once we identify a signed-in user; anonymous
       visitors still counted as events, just no stored profile. */
    person_profiles: "identified_only",
    /* We want click autocapture + custom events + pageviews only — NOT full
       session replay (records everything the user does; heavier + a privacy
       surface we don't need). Keep it off so the recorder script never loads. */
    disable_session_recording: true,
  });
  ready = true;
}

/* Attribute events to the signed-in user (stable id + email/name as props).
   Call on login. */
export function identifyUser(user) {
  if (!ready || !user) return;
  posthog.identify(user.id || user.email, {
    email: user.email,
    name: user.name || user.user_metadata?.full_name,
  });
}

/* Detach the identity on logout so the next user isn't merged into this one. */
export function resetAnalytics() {
  if (!ready) return;
  posthog.reset();
}

/* Fire a named product event, e.g. track("map_created", { source: "ai" }). */
export function track(event, props) {
  if (!ready) return;
  posthog.capture(event, props);
}

export default posthog;
