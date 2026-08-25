/* ══════════════════════════════════════════════════════════════
   placePhoto.js — resolve an image for a place.

   TWO resolvers, on purpose:

   • photoFor / onPhotoError  → the ORIGINAL behavior: a trusted
     stored photo, else a category-appropriate stock image (varied
     per place). Used by the MOBILE surfaces — unchanged, so mobile
     stays byte-identical.

   • photoStrict / onPhotoErrorStrict → HONEST: a trusted stored
     photo, else a NEUTRAL "no photo" placeholder — never a
     category stock image. Used by the DESKTOP cockpit, where a
     stock "landmark" photo had put an Eiffel Tower on a UNIQLO in
     Rome. There, real imagery comes from Google Street View (by
     coordinates, utils/usePlacePhotos) and this strict floor only
     shows the placeholder when there's genuinely no real photo.

   Stored Google Places `getUrl()` links are SHORT-LIVED signed urls
   that expire, so neither resolver trusts them as an <img src>.
   ══════════════════════════════════════════════════════════════ */

const U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=70`;

/* Stable Unsplash CDN photos (fixed ids → never 404), SEVERAL per category
   so two same-category places don't share one generic thumbnail. */
const CAT_SETS = {
  hotel:      ["photo-1566073771259-6a8506099945", "photo-1551882547-ff40c63fe5fa", "photo-1618773928121-c32242e63f39", "photo-1520250497591-112f2f40a3f4"],
  food:       ["photo-1517248135467-4c7edcad34c4", "photo-1414235077428-338989a2e8c0", "photo-1555396273-367ea4eb4db5", "photo-1552566626-52f8b828add9"],
  shopping:   ["photo-1441986300917-64674bd600d8", "photo-1481437156560-3205f6a55735", "photo-1567958451986-2de427a4a0be"],
  nature:     ["photo-1501785888041-af3ef285b470", "photo-1470071459604-3b5ec3a7fe05", "photo-1500534623283-312aade485b7"],
  beach:      ["photo-1507525428034-b723cf961d3e", "photo-1473116763249-2faaef81ccda", "photo-1519046904884-53103b34b206"],
  attraction: ["photo-1502602898657-3e91760cbb34", "photo-1499856871958-5b9627545d1a", "photo-1513581166391-887a96ddeafd"],
  transit:    ["photo-1436491865332-7a61a109cc05", "photo-1474487548417-781cb71495f3", "photo-1544620347-c4fd4a3d5957"],
  default:    ["photo-1488646953014-85cb44e25828", "photo-1476514525535-07fb3b4ae5f1", "photo-1500530855697-b586d89ba3ee"],
};

const hashStr = (s = "") => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const catKey = (category = "") => {
  const c = String(category);
  if (/מלון|לינה|אכסני|hotel|hostel|lodg|resort|motel/i.test(c)) return "hotel";
  if (/אוכל|מסעד|קפה|בר\b|פאב|food|restaurant|cafe|coffee|bar|pub|bakery|מאפ/i.test(c)) return "food";
  if (/קניו|חנות|שוק|mall|shop|store|market|קניות/i.test(c)) return "shopping";
  if (/חוף|beach/i.test(c)) return "beach";
  if (/טבע|פארק|גן|הר\b|אגם|יער|nature|park|garden|mountain|lake|forest|trail|hike/i.test(c)) return "nature";
  if (/מעבר|טיסה|רכבת|אוטובוס|transit|flight|train|bus/i.test(c)) return "transit";
  if (/אטרק|מוזי|אתר|מקדש|כנסי|ארמון|מבצר|museum|attraction|landmark|temple|church|palace|castle|monument|gallery/i.test(c)) return "attraction";
  return "default";
};

export const categoryImage = (category, seed = "") => {
  const set = CAT_SETS[catKey(category)] || CAT_SETS.default;
  return U(set[hashStr(String(seed) + "|" + catKey(category)) % set.length]);
};

/* Neutral, inline (no network) "no photo" tile — a soft grey card with the
   classic image-placeholder glyph. Honest: never misleads about a place. */
export const NO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">` +
      `<rect width="400" height="300" fill="#ECEEF1"/>` +
      `<g fill="none" stroke="#C0C7D0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="139" y="107" width="122" height="92" rx="12"/>` +
      `<circle cx="171" cy="139" r="12"/>` +
      `<path d="M148 191l38-36 26 23 31-29 31 31"/>` +
      `</g></svg>`
  );

const isHttp = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

/* A stored Google Places photo url (getUrl / photoreference / lh3
   googleusercontent) is a SHORT-LIVED SIGNED link — once saved it expires
   and 404/403s. Never trust it as an <img src>. */
const isStaleGooglePhoto = (s) =>
  typeof s === "string" &&
  /(googleusercontent\.com|maps\.googleapis\.com|maps\.gstatic\.com|\/place\/photo|photo(_?)reference=|PhotoService)/i.test(s);

const storedRealPhoto = (item) => {
  if (!item) return null;
  const p = item.photoUrl || item.photo_url || item.image_url || item.google_photo || item.photo;
  return isHttp(p) && !isStaleGooglePhoto(p) ? p : null;
};

const seedOf = (item) =>
  (item && (item.nameHe || item.name || item.title || item.place_id || "")) || "";

/* ── MOBILE (unchanged): trusted stored photo → varied category image. ── */
export const photoFor = (item) => {
  if (!item) return categoryImage("default");
  return storedRealPhoto(item) || categoryImage(item.category, seedOf(item));
};

export const onPhotoError = (item) => (e) => {
  const img = e?.currentTarget;
  if (!img || img.dataset.fb === "1") return;
  img.dataset.fb = "1";
  img.src = categoryImage(item?.category, seedOf(item));
};

/* ── DESKTOP (honest): trusted stored photo → neutral placeholder only. ── */
export const photoStrict = (item) => storedRealPhoto(item) || NO_PHOTO;

export const onPhotoErrorStrict = () => (e) => {
  const img = e?.currentTarget;
  if (!img || img.dataset.fb === "1") return;
  img.dataset.fb = "1";
  img.src = NO_PHOTO;
};

export default photoFor;
