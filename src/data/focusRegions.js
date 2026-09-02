export const FOCUS_REGIONS = {
  th: [
    { id: "central", label: "בנגקוק והמרכז", blurb: "עיר, מקדשים, שווקים", cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "איוטאיה", en: "Ayutthaya" }] },
    { id: "north", label: "הצפון", blurb: "הרים, טבע, תרבות לאנא", cities: [{ he: "צ׳אנג מאי", en: "Chiang Mai" }, { he: "פאי", en: "Pai" }] },
    { id: "south", label: "הדרום והאיים", blurb: "חופים, שנרקול, איים", cities: [{ he: "פוקט", en: "Phuket" }, { he: "קראבי", en: "Krabi" }] },
    { id: "mix", label: "בנגקוק + איים", blurb: "קלאסי — עיר ואז חוף", cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "פוקט", en: "Phuket" }] },
  ],
  jp: [
    { id: "golden", label: "המשולש הזהב", blurb: "טוקיו, קיוטו, אוסקה", cities: [{ he: "טוקיו", en: "Tokyo" }, { he: "קיוטו", en: "Kyoto" }, { he: "אוסקה", en: "Osaka" }] },
    { id: "tokyo", label: "טוקיו והסביבה", blurb: "העיר + האקונה/קמאקורה", cities: [{ he: "טוקיו", en: "Tokyo" }, { he: "האקונה", en: "Hakone" }] },
    { id: "kansai", label: "קנסאי", blurb: "קיוטו, נארה, אוסקה", cities: [{ he: "קיוטו", en: "Kyoto" }, { he: "נארה", en: "Nara" }, { he: "אוסקה", en: "Osaka" }] },
  ],
  it: [
    { id: "classic", label: "רומא–פירנצה–ונציה", blurb: "הקלאסיקה", cities: [{ he: "רומא", en: "Rome" }, { he: "פירנצה", en: "Florence" }, { he: "ונציה", en: "Venice" }] },
    { id: "south", label: "הדרום ואמלפי", blurb: "נאפולי, חוף אמלפי", cities: [{ he: "נאפולי", en: "Naples" }, { he: "אמלפי", en: "Amalfi" }] },
    { id: "north", label: "הצפון והאגמים", blurb: "מילאנו, אגם קומו", cities: [{ he: "מילאנו", en: "Milan" }, { he: "ונציה", en: "Venice" }] },
  ],
  gr: [
    { id: "cyclades", label: "אתונה והאיים", blurb: "אתונה, סנטוריני, מיקונוס", cities: [{ he: "אתונה", en: "Athens" }, { he: "סנטוריני", en: "Santorini" }, { he: "מיקונוס", en: "Mykonos" }] },
    { id: "athens", label: "אתונה והיבשת", blurb: "אתונה + מטאורה", cities: [{ he: "אתונה", en: "Athens" }, { he: "נאפליו", en: "Nafplio" }] },
    { id: "crete", label: "כרתים", blurb: "האי הגדול", cities: [{ he: "כרתים", en: "Crete" }, { he: "אתונה", en: "Athens" }] },
  ],
  vn: [
    { id: "north", label: "הצפון", blurb: "האנוי, מפרץ חאלונג", cities: [{ he: "האנוי", en: "Hanoi" }, { he: "חאלונג", en: "Ha Long Bay" }] },
    { id: "center", label: "המרכז", blurb: "הוי אן, דה נאנג", cities: [{ he: "הוי אן", en: "Hoi An" }, { he: "דה נאנג", en: "Da Nang" }] },
    { id: "south", label: "הדרום", blurb: "הו צ׳י מין ודלתת המקונג", cities: [{ he: "הו צ׳י מין", en: "Ho Chi Minh City" }, { he: "ניה טראנג", en: "Nha Trang" }] },
    { id: "full", label: "צפון לדרום", blurb: "המסלול הקלאסי", cities: [{ he: "האנוי", en: "Hanoi" }, { he: "הוי אן", en: "Hoi An" }, { he: "הו צ׳י מין", en: "Ho Chi Minh City" }] },
  ],
  ae: [
    { id: "dubai", label: "דובאי", blurb: "העיר וכל מה שבה", cities: [{ he: "דובאי", en: "Dubai" }] },
    { id: "both", label: "דובאי + אבו דאבי", blurb: "שתי הערים", cities: [{ he: "דובאי", en: "Dubai" }, { he: "אבו דאבי", en: "Abu Dhabi" }] },
    { id: "north", label: "האמירויות הצפוניות", blurb: "ראס אל ח׳יימה, שארג׳ה", cities: [{ he: "דובאי", en: "Dubai" }, { he: "ראס אל ח׳יימה", en: "Ras Al Khaimah" }] },
  ],
  fr: [
    { id: "paris", label: "פריז והסביבה", blurb: "העיר + ורסאי", cities: [{ he: "פריז", en: "Paris" }] },
    { id: "provence", label: "פרובנס והריביירה", blurb: "ניס, קאן", cities: [{ he: "ניס", en: "Nice" }, { he: "קאן", en: "Cannes" }] },
    { id: "loire", label: "מרכז ודרום", blurb: "ליון, בורדו", cities: [{ he: "ליון", en: "Lyon" }, { he: "בורדו", en: "Bordeaux" }] },
  ],
  es: [
    { id: "classic", label: "מדריד וברצלונה", blurb: "שתי הערים הגדולות", cities: [{ he: "מדריד", en: "Madrid" }, { he: "ברצלונה", en: "Barcelona" }] },
    { id: "andalusia", label: "אנדלוסיה", blurb: "סביליה, גרנדה", cities: [{ he: "סביליה", en: "Seville" }, { he: "גרנדה", en: "Granada" }] },
    { id: "north", label: "הצפון", blurb: "סן סבסטיאן, בילבאו", cities: [{ he: "סן סבסטיאן", en: "San Sebastian" }, { he: "בילבאו", en: "Bilbao" }] },
  ],
  us: [
    { id: "east", label: "החוף המזרחי", blurb: "ניו יורק, וושינגטון, בוסטון", cities: [{ he: "ניו יורק", en: "New York" }, { he: "וושינגטון", en: "Washington, D.C." }, { he: "בוסטון", en: "Boston" }] },
    { id: "west", label: "החוף המערבי", blurb: "לוס אנג׳לס, סן פרנסיסקו", cities: [{ he: "לוס אנג׳לס", en: "Los Angeles" }, { he: "סן פרנסיסקו", en: "San Francisco" }] },
    { id: "swest", label: "דרום-מערב", blurb: "לאס וגאס והפארקים", cities: [{ he: "לאס וגאס", en: "Las Vegas" }, { he: "לוס אנג׳לס", en: "Los Angeles" }] },
  ],
  pt: [
    { id: "classic", label: "ליסבון ופורטו", blurb: "שתי הערים + סינטרה", cities: [{ he: "ליסבון", en: "Lisbon" }, { he: "פורטו", en: "Porto" }] },
    { id: "lisbon", label: "ליסבון והסביבה", blurb: "ליסבון, סינטרה, קשקאיש", cities: [{ he: "ליסבון", en: "Lisbon" }, { he: "סינטרה", en: "Sintra" }] },
    { id: "south", label: "האלגרבה", blurb: "חופי הדרום", cities: [{ he: "לאגוס", en: "Lagos" }, { he: "פארו", en: "Faro" }] },
  ],
};
