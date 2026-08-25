/* Gallery pure helpers — no React, unit-tested. */

/* Logged-out viewers see the first ~30% of a trip's days (min 1). */
export const visibleDayCount = (totalDays) =>
  Math.max(1, Math.ceil((Number(totalDays) || 0) * 0.3));

export const coverIsEmoji = (cover) => typeof cover === "string" && cover.startsWith("emoji:");
export const coverEmoji = (cover) => (coverIsEmoji(cover) ? cover.slice("emoji:".length) : "");

export const GALLERY_CATEGORIES = [
  { slug: "urban", label: "עירוני" },
  { slug: "nature", label: "טבע" },
  { slug: "family", label: "משפחות" },
  { slug: "romantic", label: "רומנטי" },
  { slug: "food", label: "אוכל" },
  { slug: "culture", label: "תרבות" },
  { slug: "beaches", label: "חופים" },
  { slug: "adventure", label: "הרפתקאות" },
];
export const categoryLabel = (slug) => (GALLERY_CATEGORIES.find((c) => c.slug === slug) || {}).label || "";

export const COVER_EMOJIS = ["🗼","🏛️","⛩️","🏖️","🌋","🕌","🗺️","🏙️","🏔️","🌉","🏝️","🎡","🚂","🍜","🍷","🏰","🕍","🛕","🐚","🌸"];
