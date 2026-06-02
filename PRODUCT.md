# Product

## Register

product

## Users

Hebrew-speaking travellers (RTL-first) planning multi-stop trips with a partner / friend / small group.

- **Context at home (desktop, browser):** scaffolding the trip — choosing a destination, blocking days, dropping anchor cities.
- **Context on the go (mobile, on the trip):** opening a stop on the map, copying a Maps link, jumping a friend straight to a place.
- **Job to be done:** "build a day-by-day itinerary that I can share, edit, and trust when I'm actually there."

Primary surfaces:
1. The merged Maps + Profile hub (`/dashboard`) — the home screen.
2. The wizard (`/create`) — destination → duration → city routing → summary.
3. The editor (`/map/edit/:id`) — map + 3-snap bottom sheet, day-by-day stops, drag-reorder.
4. The Japan example (`/japan` + `/map?demo=1`) — proof of what a finished itinerary looks like.

## Product Purpose

A SaaS map-builder for personal trip itineraries. Compete with shared Google Sheets and screenshot-glued Pinterest boards by being: visual (real map, real photos), collaborative (share-by-email like Google Docs), and intelligent (auto walk/transit times between stops, country-aware city suggestions).

Success looks like: a couple plans a 10-day trip in under an hour, opens it 30 times during the trip, and shares it three months later as the "definitive" itinerary.

## Brand Personality

**Warm · Deliberate · Journeyful.**

- Travel-vibey like Hopper / Airbnb Trips, but quieter and more premium.
- Photography is the hero. Real places. Real warmth.
- Optimistic without being childish. Confident without being corporate.
- Hebrew-first, never translated-feeling.

## Anti-references

This product must NOT look like:

- **Generic SaaS template:** Inter on everything, purple-to-blue gradients, rounded-square icon tiles above every heading, cards-inside-cards, Tailwind UI default.
- **Heavy / corporate / cluttered:** dense admin panels, dropdown overload, mid-2010s info-dashboards, anything that wants you to "use it at your desk for 8 hours."
- **Toy-like / over-cartoonish:** jelly buttons, sticker-emoji as primary art, bouncing easings, hover micro-interactions that wave at you.
- **Plain travel-blog WordPress:** generic stock travel photos, narrow column of body text, dated typography, hero-image-and-paragraph layouts.

## Design Principles

1. **Photography is the hero.** Every primary surface earns a real photo where possible. Country illustrations on cards are fallbacks, not the goal.
2. **Hebrew-first, RTL-native.** Logical properties everywhere (`insetInlineStart`, `marginInlineEnd`). No mirrored icons, no translated copy. The interface should feel born-in-Hebrew.
3. **Quiet confidence.** Restrained palette, generous whitespace, expressive only at moments of arrival (summary screen, "we're ready" beats).
4. **One job per screen.** Wizard step does one thing. Settings row does one thing. The dashboard merges Profile+Maps because they ARE one job ("my trips"). Resist adding "everything" sections.
5. **Travel-rhythm motion.** Motion mimics journey beats — gentle `cubic-bezier(0.22, 1, 0.36, 1)`, staggered card entrances, never bouncy / never showy. Reduced-motion always honored.

## Accessibility & Inclusion

- **WCAG 2.2 AA target.** Text contrast ≥4.5:1 (normal), ≥3:1 (large + UI components and graphics). Verified in both light and dark palettes.
- **RTL-native.** All new components must use logical properties; no `left/right` literals.
- **Reduced motion guard.** Already in `index.css` (`@media (prefers-reduced-motion: reduce)`). New animations must respect it.
- **Touch targets ≥44×44 px** on mobile. Floating dock currently 48px ✓.
- **Dark mode** via shared `useDarkMode()` hook. New screens must consume the palette, not hard-code colors.
- **Keyboard:** every overlay (sheets, modals, side menu, onboarding) must trap focus and close on `Esc`. Several currently don't — flagged in `/impeccable harden`.
- **Screen reader:** the bottom dock items are emoji-only — add `aria-label`s and proper `aria-current` for the active item (BottomDock already does this partly).
