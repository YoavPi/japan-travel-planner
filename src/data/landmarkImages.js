// Curated landmark images — high-quality Unsplash photos for each key destination
// Using Unsplash Source for reliable, free, no-API-key image URLs
// Format: unsplash random with search term, fixed size for consistency

const UNS = (query, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${query}?w=${w}&h=${h}&fit=crop&q=80`;

// ═══════════════════════════════════════════
// HERO IMAGES — One per day (city/area vibe)
// ═══════════════════════════════════════════
export const dayHeroImages = {
  // Tokyo Days
  1: UNS("1540959733332-eab206aee64d", 900, 400),   // Harajuku street
  2: UNS("1542051841857-5f90071e7989", 900, 400),   // Shinjuku neon
  3: UNS("1624601573012-efb68931cc8f", 900, 400),   // Tokyo Disneyland castle
  4: UNS("1565618754154-c8e209f93c74", 900, 400),   // DisneySea
  5: UNS("1532236204992-f5e82c553bb8", 900, 400),   // Shibuya crossing
  // Kanazawa
  6: UNS("1589452271712-4774d1fa6432", 900, 400),   // Kanazawa garden
  // Takayama
  7: UNS("1578469645742-46cae010e5d4", 900, 400),   // Shirakawa-go snow
  // Matsumoto
  8: UNS("1590253230532-a67f6bc61c9e", 900, 400),   // Ski resort Japan
  // Nagoya
  9: UNS("1545569341-9eb8b30979d9", 900, 400),      // Matsumoto Castle
  // Osaka
  10: UNS("1590559899731-a382cb0f22f2", 900, 400),  // Osaka Castle
  11: UNS("1624453384498-f3001a6dac57", 900, 400),  // Universal Studios Osaka
  12: UNS("1553621042-f6e147245754", 900, 400),     // Dotonbori
  // Nara
  13: UNS("1528360983277-13d401cdc186", 900, 400),  // Nara deer
  // Kyoto
  14: UNS("1493976040374-85c8e12f0c0e", 900, 400),  // Kyoto temple
  15: UNS("1478436127897-769e1b3f0f36", 900, 400),  // Fushimi Inari torii gates
  16: UNS("1504198453319-5ce911bafcde", 900, 400),  // Kyoto tea house
  17: UNS("1526481280693-3bfa7568e0f3", 900, 400),  // Bamboo grove
  18: UNS("1545569341-9eb8b30979d9", 900, 400),     // Kyoto pagoda
  // Back to Tokyo
  19: UNS("1540959733332-eab206aee64d", 900, 400),  // Tokyo street
  20: UNS("1576495199011-eb94736d05d4", 900, 400),  // Ueno sakura
  21: UNS("1558618666-fcd25c85f1aa", 900, 400),     // Akihabara
  22: UNS("1558618666-fcd25c85f1aa", 900, 400),     // TeamLab / Odaiba
  // Fuji area
  23: UNS("1490806843957-31f4c9a91c65", 900, 400),  // Mt Fuji & lake
  24: UNS("1492571350019-22de08371fd3", 900, 400),  // Hakone
  25: UNS("1490806843957-31f4c9a91c65", 900, 400),  // Fuji clear view
  // Final Tokyo
  26: UNS("1536098561742-ca998e48cbcc", 900, 400),  // Tokyo skyline
  27: UNS("1551641506-ee5bf4cb45f1", 900, 400),     // Roppongi
  28: UNS("1570521462033-3015e76e7432", 900, 400),  // Ikebukuro
  29: UNS("1542051841857-5f90071e7989", 900, 400),  // Nakameguro
  30: UNS("1532236204992-f5e82c553bb8", 900, 400),  // Shibuya night
  31: UNS("1480796927426-f609979314bd", 900, 400),  // Japan goodbye sunset
};

// ═══════════════════════════════════════════
// ATTRACTION IMAGES — Specific landmark photos
// Key = exact attraction name from tripData
// ═══════════════════════════════════════════
export const attractionImages = {
  // Tokyo
  "Harajuku & Omotesando":     UNS("1540959733332-eab206aee64d", 400, 300),
  "AFURI Harajuku":            UNS("1557872943-16a5ac26437e", 400, 300),  // ramen
  "Anakuma Cafe":              UNS("1509042239860-f550ce710b93", 400, 300),  // cute cafe
  "Shibuya Crossing":          UNS("1532236204992-f5e82c553bb8", 400, 300),
  "Don Quijote Shibuya":       UNS("1558618666-fcd25c85f1aa", 400, 300),
  "Shinjuku Gyoen":            UNS("1522383225653-ed111181a951", 400, 300),  // Japanese garden
  "Golden Gai":                UNS("1551641506-ee5bf4cb45f1", 400, 300),
  "Shinjuku":                  UNS("1542051841857-5f90071e7989", 400, 300),
  // Disney
  "Monsters Inc.":             UNS("1624601573012-efb68931cc8f", 400, 300),
  "Beauty and the Beast":      UNS("1624601573012-efb68931cc8f", 400, 300),
  "Soaring: Fantastic Flight": UNS("1565618754154-c8e209f93c74", 400, 300),
  // Shibuya & more Tokyo
  "Shibuya — Hachiko":         UNS("1532236204992-f5e82c553bb8", 400, 300),
  "Omoide Yokocho":            UNS("1551641506-ee5bf4cb45f1", 400, 300),
  "Little Darling Coffee Roasters": UNS("1509042239860-f550ce710b93", 400, 300),
  "PARCO Shibuya":             UNS("1540959733332-eab206aee64d", 400, 300),
  "3D Billboard Shinjuku":     UNS("1542051841857-5f90071e7989", 400, 300),
  // Kanazawa
  "Shinkansen to Kanazawa":    UNS("1548276145-69a0d3fa1060", 400, 300),  // shinkansen
  "Hotel Kanazawa Zoushi":     UNS("1589452271712-4774d1fa6432", 400, 300),
  "Kanazawa City Walk":        UNS("1589452271712-4774d1fa6432", 400, 300),
  // Takayama / Shirakawa-go
  "Shirakawa-go":              UNS("1578469645742-46cae010e5d4", 400, 300),
  // Matsumoto
  "Hiryu Ski Resort":          UNS("1590253230532-a67f6bc61c9e", 400, 300),
  // Nagoya / Matsumoto Castle
  "Matsumoto Castle":          UNS("1545569341-9eb8b30979d9", 400, 300),
  "Kusama Yayoi Museum":       UNS("1545569341-9eb8b30979d9", 400, 300),
  "Michelin Café":             UNS("1509042239860-f550ce710b93", 400, 300),
  // Osaka
  "Osaka Castle":              UNS("1590559899731-a382cb0f22f2", 400, 300),
  "Food Tour with Liran":      UNS("1553621042-f6e147245754", 400, 300),
  "Super Nintendo World":      UNS("1624453384498-f3001a6dac57", 400, 300),
  "Wizarding World of Harry Potter": UNS("1624453384498-f3001a6dac57", 400, 300),
  "Namba Yasaka Shrine":       UNS("1493976040374-85c8e12f0c0e", 400, 300),
  "Kuromon Ichiba Market":     UNS("1553621042-f6e147245754", 400, 300),
  "Dotonbori":                 UNS("1553621042-f6e147245754", 400, 300),
  // Nara
  "Nara Park & Deer":          UNS("1528360983277-13d401cdc186", 400, 300),
  "Todai-ji Temple":           UNS("1528360983277-13d401cdc186", 400, 300),
  // Kyoto
  "Maruyama Park":             UNS("1493976040374-85c8e12f0c0e", 400, 300),
  "Fushimi Inari Shrine":     UNS("1478436127897-769e1b3f0f36", 400, 300),
  "Nishiki Market":            UNS("1553621042-f6e147245754", 400, 300),
  "Ogawa Coffee":              UNS("1509042239860-f550ce710b93", 400, 300),
  "Arashiyama Bamboo Grove":   UNS("1526481280693-3bfa7568e0f3", 400, 300),
  "Kinkaku-ji (Golden Pavilion)": UNS("1493976040374-85c8e12f0c0e", 400, 300),
  "Hokanji Pagoda":            UNS("1545569341-9eb8b30979d9", 400, 300),
  "Starbucks Ninenzaka":       UNS("1504198453319-5ce911bafcde", 400, 300),
  "Hokanji Morning Photos":    UNS("1545569341-9eb8b30979d9", 400, 300),
  "UZU Ramen (TeamLab)":       UNS("1557872943-16a5ac26437e", 400, 300),
  // More Tokyo
  "Akihabara":                 UNS("1558618666-fcd25c85f1aa", 400, 300),
  "Super Potato":              UNS("1558618666-fcd25c85f1aa", 400, 300),
  "Radio Kaikan":              UNS("1558618666-fcd25c85f1aa", 400, 300),
  "TeamLab Planets":           UNS("1558618666-fcd25c85f1aa", 400, 300),
  "Katsuobushi Shibuya":       UNS("1557872943-16a5ac26437e", 400, 300),
  "Ueno Park":                 UNS("1576495199011-eb94736d05d4", 400, 300),
  "Kappabashi Street":         UNS("1570521462033-3015e76e7432", 400, 300),
  "Sunshine City Ikebukuro":   UNS("1570521462033-3015e76e7432", 400, 300),
  // Fuji / Hakone
  "Lake Kawaguchiko":          UNS("1490806843957-31f4c9a91c65", 400, 300),
  "Mt. Fuji Clear View!":     UNS("1490806843957-31f4c9a91c65", 400, 300),
  "Chureito Pagoda":           UNS("1490806843957-31f4c9a91c65", 400, 300),
  "Gotemba Premium Outlets":   UNS("1490806843957-31f4c9a91c65", 400, 300),
  "Hakone Viewpoints":         UNS("1492571350019-22de08371fd3", 400, 300),
  "Hakone Ropeway":            UNS("1492571350019-22de08371fd3", 400, 300),
  "Hakone Open Air Museum":    UNS("1492571350019-22de08371fd3", 400, 300),
  "BRICOLAGE Bread & Co.":    UNS("1509042239860-f550ce710b93", 400, 300),
  "Starbucks Reserve Nakameguro": UNS("1509042239860-f550ce710b93", 400, 300),
  "Tokyo Metropolitan Gov. Building": UNS("1536098561742-ca998e48cbcc", 400, 300),
  "Nakameguro":                UNS("1522383225653-ed111181a951", 400, 300),
  "Shinjuku Gyoen":            UNS("1522383225653-ed111181a951", 400, 300),
  "Harajuku (Last Visit)":     UNS("1540959733332-eab206aee64d", 400, 300),
};

// ═══════════════════════════════════════════
// FOOD IMAGES — Restaurants & food spots
// ═══════════════════════════════════════════
export const foodImages = {
  "AFURI Harajuku":            UNS("1557872943-16a5ac26437e", 400, 250),  // yuzu ramen
  "Sushi Zanmai":              UNS("1579871494447-9811cf80d66c", 400, 250),  // sushi
  "FUUNJI":                    UNS("1557872943-16a5ac26437e", 400, 250),
  "Golden Gai Bar":            UNS("1551641506-ee5bf4cb45f1", 400, 250),
  "Ichiran Ramen Shinjuku":    UNS("1557872943-16a5ac26437e", 400, 250),
  "Ichiran Ramen Dotonbori":   UNS("1557872943-16a5ac26437e", 400, 250),
  "Mazesoba Restaurant":       UNS("1557872943-16a5ac26437e", 400, 250),
  "Ramen Hayato":              UNS("1557872943-16a5ac26437e", 400, 250),
  "Shishimaru Ramen":          UNS("1557872943-16a5ac26437e", 400, 250),
  "GION DUCK":                 UNS("1553621042-f6e147245754", 400, 250),
  "Gyoza Motoi":               UNS("1553621042-f6e147245754", 400, 250),
  "Kuromon Ichiba Market":     UNS("1553621042-f6e147245754", 400, 250),
  "UZU Ramen (TeamLab)":       UNS("1557872943-16a5ac26437e", 400, 250),
  "Ramen HAYASHI":             UNS("1557872943-16a5ac26437e", 400, 250),
  "HIRUKA Roppongi":           UNS("1553621042-f6e147245754", 400, 250),
  "Standing Sushi Shibuya":    UNS("1579871494447-9811cf80d66c", 400, 250),
  "Yakiniku Roppongi":         UNS("1553621042-f6e147245754", 400, 250),
  "Burger Revolution Kyoto":   UNS("1553621042-f6e147245754", 400, 250),
  "Nishiki Market":            UNS("1553621042-f6e147245754", 400, 250),
  "AFURI (Last Ramen!)":       UNS("1557872943-16a5ac26437e", 400, 250),
  "PIZZA MIRITA":              UNS("1553621042-f6e147245754", 400, 250),
  "Soba Restaurant":           UNS("1553621042-f6e147245754", 400, 250),
  "Michelin Café":             UNS("1509042239860-f550ce710b93", 400, 250),
};

// ═══════════════════════════════════════════
// VIBE DESCRIPTIONS — Hebrew atmospheric descriptions for key landmarks (2-3 lines)
// Rendered with dir="rtl" in UI components.
// ═══════════════════════════════════════════
export const vibeDescriptions = {
  // ── טוקיו (מרכז) ──
  "Harajuku & Omotesando":
    "הלב הפועם של אופנת הרחוב של טוקיו לצד בוטיקים יוקרתיים. שילוב מושלם בין תרבות נוער צבעונית לארכיטקטורה מתוחכמת.",
  "AFURI Harajuku":
    "מוסד ראמן מפורסם בזכות ציר ה-Yuzu הקליל והמרענן שלו וחזיר צלוי על פחמים. המועדף על חובבי ראמן מודרני.",
  "AFURI (Last Ramen!)":
    "מוסד ראמן מפורסם בזכות ציר ה-Yuzu הקליל והמרענן שלו וחזיר צלוי על פחמים. המועדף על חובבי ראמן מודרני.",
  "Anakuma Cafe":
    "בית קפה ייחודי שבו כף יד של דוב מושיטה לכם את הקפה דרך חור בקיר. חוויה מסתורית, חמודה ויוצאת דופן.",
  "Shibuya Crossing":
    "צומת הולכי הרגל העמוס בעולם. מחזה חובה של אורות ניאון, מסכי ענק וכאוס מסונכרן להפליא.",
  "Yoyogi Park":
    "נווה מדבר ירוק ועצום שבו המקומיים עושים פיקניקים, מתאמנים ומופיעים ברחוב. שוקק חיים במיוחד בימי ראשון.",
  "Nezu Museum":
    "אוסף פרטי מרהיב של אמנות יפנית ואסייתית, הכולל גן זן ברמה עולמית שמרגיש כמו עולם אחר בלב העיר.",
  "Don Quijote Shibuya":
    "חנות דיסקאונט ענקית ומבולגנת שבה אפשר למצוא הכל – מחטיפים יפנים מוזרים ועד מזוודות יוקרה.",
  "Sushi Zanmai":
    "רשת סושי פופולרית ואהובה המציעה דגים טריים מאוד במחירים נגישים, עם אווירה תוססת ושירות מהיר.",
  "Shinjuku Gyoen":
    "אחד הפארקים הגדולים והיפים בטוקיו, המשלב גנים צרפתיים, אנגליים וגנים יפניים מסורתיים עוצרי נשימה.",
  "Golden Gai":
    "רשת סמטאות צרות בשינג'וקו עם מעל 200 ברים קטנטנים, כל אחד עם עיצוב ונושא ייחודי משלו.",
  "Golden Gai Bar":
    "רשת סמטאות צרות בשינג'וקו עם מעל 200 ברים קטנטנים, כל אחד עם עיצוב ונושא ייחודי משלו.",
  "FUUNJI":
    "מקום אגדי בשינג'וקו המפורסם בראמן ה-\"Tsukemen\" (אטריות לטבילה) עם ציר דגים סמיך ועשיר במיוחד.",
  "Ichiran Ramen Shinjuku":
    "חוויית ראמן אישית בתאים נפרדים, שבה ניתן להתאים אישית כל מרכיב בקערה – מהחריפות ועד מידת עשיית האטריות.",
  "Ichiran Ramen Dotonbori":
    "חוויית ראמן אישית בתאים נפרדים, שבה ניתן להתאים אישית כל מרכיב בקערה – מהחריפות ועד מידת עשיית האטריות.",
  "Omoide Yokocho":
    "ידועה כ\"סמטת הזיכרונות\", סמטה צרה ונוסטלגית המלאה בדוכני יאקיטורי ואווירה של פעם.",
  "Standing Sushi Shibuya":
    "חוויה יפנית קלאסית של סושי איכותי בעמידה. מהיר, טרי ובדיוק כמו שהמקומיים אוהבים.",
  "BRICOLAGE Bread & Co.":
    "מאפייה ומסעדה נהדרת ברופונגי המשלבת טכניקות צרפתיות עם חומרי גלם יפניים לארוחות בוקר בלתי נשכחות.",

  // ── קנאזאווה, טקיאמה ומטסומוטו ──
  "Omicho Fish Market":
    "\"המטבח של קנאזאווה\" – שוק דגים פעיל כבר מעל 280 שנה המציע פירות ים טריים וסושי מעולה מהים הקרוב.",
  "Omicho Fish Market Sushi":
    "\"המטבח של קנאזאווה\" – שוק דגים פעיל כבר מעל 280 שנה המציע פירות ים טריים וסושי מעולה מהים הקרוב.",
  "Kenroku-en Garden":
    "נחשב לאחד משלושת הגנים היפים ביותר ביפן; הוא מרהיב בכל עונה, במיוחד עם חבלי ה-\"Yukitsuri\" בחורף.",
  "Shirakawa-go":
    "כפר שהוכרז כאתר מורשת עולמית של אונסק\"ו, מפורסם בבתי החווה עם גגות הקש התלולים שנראים כמו ידיים בתפילה.",
  "Matsumoto Castle":
    "אחת המצודות ההיסטוריות החשובות ביפן, המכונה \"טירת העורב\" בשל הצבע השחור והמרשים שלה.",
  "Shishimaru Ramen":
    "ראמן ייחודי המבוסס על מרק עוף קטיפתי ומקציף, המעניק חוויה קולינרית שונה ומתוחכמת בנגויה.",

  // ── אוסקה ונארה ──
  "Osaka Castle":
    "ציוני דרך מפואר המוקף בחפיר עצום ופארק, המספר את סיפור איחוד יפן במאה ה-16.",
  "Dotonbori":
    "רובע הבילויים והאוכל של אוסקה. מפורסם בשלט \"Glico Man\", באוכל רחוב כמו טאקויאקי ובאנרגיה בלתי נגמרת.",
  "Nara Park & Deer":
    "ביתם של מאות איילים המסתובבים חופשי. הם נחשבים לקדושים ויקדו לכם קידה אם תאכילו אותם בקרקרים מיוחדים.",
  "Ramen Hayato":
    "מסעדה קטנה ומוערכת באוסקה המתמחה בראמן מיסו עשיר ומאוזן שזכה לשבחים רבים בקרב חובבי קולינריה.",

  // ── קיוטו ──
  "Fushimi Inari Shrine":
    "מפורסם באלפי שערים כתומים (Torii) היוצרים מסלול הליכה מרהיב במעלה ההר לכבוד אל האורז.",
  "Nishiki Market":
    "שוק מסורתי בן 400 שנה המציע מעדנים מקומיים כמו דונאטס מחלב סויה ושיפודי תמנון קטנים.",
  "Gyoza Motoi":
    "פנינה קולינרית המופיעה במדריך מישלן, המגישה גיוזה מוקפדת עם שילובי טעמים מפתיעים כמו ג'ינג'ר וכוסברה.",
  "GION DUCK":
    "מסעדה מיוחדת המתמחה במנות ברווז המוגשות על אורז, עם עיצוב מינימליסטי ודגש על חומרי גלם איכותיים.",
  "UZU Ramen (TeamLab)":
    "חוויה סוריאליסטית של אכילת ראמן טבעוני בתוך מיצב אמנות דיגיטלי של TeamLab, שילוב בין טעם לאסתטיקה מרהיבה.",

  // ── פוג'י והאקונה ──
  "Lake Kawaguchiko":
    "אחד מחמשת אגמי פוג'י, המציע את נופי הגלויות היפים ביותר של הר פוג'י המשתקף במים.",
  "Chureito Pagoda":
    "פגודה על צלע הר המשקיפה על העיר ועל הר פוג'י ברקע – התמונה היפנית האולטימטיבית.",
  "The Park (Pancakes)":
    "בית קפה פופולרי בהאקונה הידוע בפנקייקים האווריריים והנמסים שלו, המוגשים מול נוף פסטורלי.",
};

export default { dayHeroImages, attractionImages, foodImages, vibeDescriptions };
