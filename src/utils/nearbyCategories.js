// src/utils/nearbyCategories.js
/* Fixed category chips for "מצא לי X באזור". `type` is a Google Places
   nearbySearch place type; `id === type` for the fixed set. */
export const NEARBY_CATEGORIES = [
  { id: "restaurant",        label: "מסעדות",     emoji: "🍽️", type: "restaurant" },
  { id: "cafe",              label: "בתי קפה",    emoji: "☕",  type: "cafe" },
  { id: "supermarket",       label: "סופרמרקט",   emoji: "🛒", type: "supermarket" },
  { id: "tourist_attraction",label: "אטרקציות",   emoji: "🏛️", type: "tourist_attraction" },
  { id: "bar",               label: "ברים",       emoji: "🍺", type: "bar" },
  { id: "pharmacy",          label: "בית מרקחת",  emoji: "💊", type: "pharmacy" },
  { id: "atm",               label: "כספומט",     emoji: "🏧", type: "atm" },
];

export default NEARBY_CATEGORIES;
