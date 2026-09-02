/* Global destinations with map center + default zoom (drives the
   editor's dynamic viewport instead of the hardcoded Japan view). */
export const DESTINATIONS = [
  { id: "jp", flag: "🇯🇵", name: "יפן", en: "Japan", sub: "אסיה · 4–14 ימים", center: { lng: 138.2529, lat: 36.2048, zoom: 5 }, popular: true },
  { id: "it", flag: "🇮🇹", name: "איטליה", en: "Italy", sub: "אירופה · 7–14 ימים", center: { lng: 12.5674, lat: 41.8719, zoom: 5.4 } },
  { id: "pt", flag: "🇵🇹", name: "פורטוגל", en: "Portugal", sub: "אירופה · 7–10 ימים", center: { lng: -8.2245, lat: 39.5, zoom: 6 } },
  { id: "gr", flag: "🇬🇷", name: "יוון", en: "Greece", sub: "אירופה · 5–10 ימים", center: { lng: 23.7, lat: 38.5, zoom: 5.8 } },
  { id: "th", flag: "🇹🇭", name: "תאילנד", en: "Thailand", sub: "אסיה · 10–21 ימים", center: { lng: 100.9925, lat: 15.87, zoom: 5 } },
  { id: "vn", flag: "🇻🇳", name: "וייטנאם", en: "Vietnam", sub: "אסיה · 10–14 ימים", center: { lng: 108.2772, lat: 16.0, zoom: 5.2 } },
  { id: "ae", flag: "🇦🇪", name: "דובאי", en: "Dubai", sub: "המפרץ · 4–7 ימים", center: { lng: 55.2708, lat: 25.2048, zoom: 9 } },
  { id: "fr", flag: "🇫🇷", name: "צרפת", en: "France", sub: "אירופה · 5–10 ימים", center: { lng: 2.2137, lat: 46.2276, zoom: 5.2 } },
  { id: "es", flag: "🇪🇸", name: "ספרד", en: "Spain", sub: "אירופה · 7–12 ימים", center: { lng: -3.7492, lat: 40.0, zoom: 5.4 } },
  { id: "us", flag: "🇺🇸", name: "ארה״ב", en: "USA", sub: "צפון אמריקה · 10–21 ימים", center: { lng: -98.5, lat: 39.8, zoom: 3.6 } },
];

/* Suggested cities per destination — shown as quick-add chips in
   the city-routing step so users don't start from a blank field. */
export const SUGGESTED_CITIES = {
  jp: ["טוקיו", "קיוטו", "אוסקה", "האקונה", "נארה", "קנזאווה"],
  it: ["רומא", "פירנצה", "ונציה", "מילאנו", "אמלפי", "נאפולי"],
  pt: ["ליסבון", "פורטו", "סינטרה", "לאגוס"],
  gr: ["אתונה", "סנטוריני", "מיקונוס", "כרתים"],
  th: ["בנגקוק", "צ׳אנג מאי", "פוקט", "קו סמוי"],
  vn: ["האנוי", "הוי אן", "הו צ׳י מין", "חאלונג"],
  ae: ["דובאי", "אבו דאבי"],
  fr: ["פריז", "ניס", "ליון", "בורדו"],
  es: ["מדריד", "ברצלונה", "סביליה", "גרנדה"],
  us: ["ניו יורק", "לוס אנג׳לס", "סן פרנסיסקו", "לאס וגאס"],
};

/* Larger searchable city pool per country (superset of the
   suggested chips) — powers the autocomplete search field. */
export const CITY_POOL = {
  jp: ["טוקיו", "קיוטו", "אוסקה", "האקונה", "נארה", "קנזאווה", "יוקוהמה", "נגויה", "סאפורו", "הירושימה", "ניקו", "קמאקורה", "טקיאמה", "מטסומוטו", "קוואגוצ׳יקו", "אוקינאווה"],
  it: ["רומא", "פירנצה", "ונציה", "מילאנו", "אמלפי", "נאפולי", "פיזה", "סיינה", "בולוניה", "ורונה", "טורינו", "פלרמו", "סורנטו", "צ׳ינקווה טרה"],
  pt: ["ליסבון", "פורטו", "סינטרה", "לאגוס", "פארו", "קוימברה", "מדיירה", "אבורה"],
  gr: ["אתונה", "סנטוריני", "מיקונוס", "כרתים", "רודוס", "קורפו", "נאפליו", "מטאורה"],
  th: ["בנגקוק", "צ׳אנג מאי", "פוקט", "קו סמוי", "קראבי", "איוטאיה", "פאי", "קו פנגן"],
  vn: ["האנוי", "הוי אן", "הו צ׳י מין", "חאלונג", "דה נאנג", "סאפא", "ניה טראנג", "הואה"],
  ae: ["דובאי", "אבו דאבי", "שארג׳ה", "ראס אל ח׳יימה"],
  fr: ["פריז", "ניס", "ליון", "בורדו", "מרסיי", "סטרסבורג", "קאן", "אנסי", "ביאריץ"],
  es: ["מדריד", "ברצלונה", "סביליה", "גרנדה", "ולנסיה", "מלגה", "סן סבסטיאן", "בילבאו", "טולדו"],
  us: ["ניו יורק", "לוס אנג׳לס", "סן פרנסיסקו", "לאס וגאס", "מיאמי", "שיקגו", "בוסטון", "וושינגטון", "סיאטל", "ניו אורלינס"],
};

/* Derived: English country name → destination id */
export const COUNTRY_EN_TO_ID = DESTINATIONS.reduce((m, d) => { m[d.en] = d.id; return m; }, {});
