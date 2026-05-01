// Japan Honeymoon Trip Data
// Every attraction/restaurant has: coordinates, nameJa (Japanese), nameHe (Hebrew), name (English)

const tripData = [
  {
    day: 1, title: "יום 1 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.6917, lat: 35.6895 },
    attractions: [
      { name: "Harajuku & Omotesando", nameJa: "原宿・表参道", nameHe: "האראג'וקו ואומוטסנדו", desc: "הסתובבנו ברחוב Omotesando, יוניקלו", coordinates: { lng: 139.7074, lat: 35.6693 } },
      { name: "Meiji Shrine + Yoyogi Park", nameJa: "明治神宮・代々木公園", nameHe: "מקדש מייג'י + פארק יויוגי", desc: "מקדש שינטו ביער שלם בלב טוקיו", coordinates: { lng: 139.6993, lat: 35.6764 } },
      { name: "AFURI Harajuku", nameJa: "阿夫利 原宿", nameHe: "אפורי האראג'וקו", desc: "ראמן עוף מבוסס יוזו. יש גם אופציה לטבעוני. אמאלה! ציון: 9/10", coordinates: { lng: 139.7054, lat: 35.6691 } },
      { name: "Anakuma Cafe", nameJa: "あなくまカフェ", nameHe: "אנאקומה קפה", desc: "הקפה שמוגש על ידי 'יד של דוב' דרך חור בקיר", coordinates: { lng: 139.7046, lat: 35.6702 } },
      { name: "Nezu Museum", nameJa: "根津美術館", nameHe: "מוזיאון נזו", desc: "מוזיאון אמנות עם גן יפני — שקט ויפה", coordinates: { lng: 139.7137, lat: 35.6614 } },
      { name: "Shibuya Crossing", nameJa: "渋谷スクランブル交差点", nameHe: "שיבויה קרוסינג", desc: "עברנו בצומת המפורסם", coordinates: { lng: 139.7005, lat: 35.6595 } },
      { name: "Don Quijote Shibuya", nameJa: "ドン・キホーテ 渋谷", nameHe: "דון קיחוטה שיבויה", desc: "יש הכל מהכל!", coordinates: { lng: 139.6989, lat: 35.6598 } },
      { name: "GIGO Arcade Shibuya", nameJa: "GiGO 渋谷", nameHe: "ארקייד GIGO שיבויה", desc: "ערב במכונות משחקים ופרסים", coordinates: { lng: 139.7000, lat: 35.6605 } },
    ],
    lunch: { place: "AFURI Harajuku", nameJa: "阿夫利 原宿", nameHe: "אפורי האראג'וקו", desc: "ראמן עוף מבוסס יוזו. יש גם אופציה לטבעוני. אמאלה! ציון: 9/10", rating: "9/10", coordinates: { lng: 139.7054, lat: 35.6691 } },
    dinner: { place: "Sushi Zanmai", nameJa: "すしざんまい", nameHe: "סושי זנמאי", desc: "סושי זול וטוב ליד המלון ברופונגי. ציון: 7/10", rating: "7/10", coordinates: { lng: 139.7305, lat: 35.6612 } },
    tips: ["AFURI — ראמן מומלץ מאוד, חצי שעה תור שווה כל שקל", "דון קיחוטה פתוח עד מאוחר — מושלם לקניות", "FAMILY MART — סלט ביצים וסאנדו שרימפס מעולים לבוקר"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "855 ₪", highlights: "סושי זנמאי, ראמן אפורי" }, images: [],
  },
  {
    day: 2, title: "יום 2 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7005, lat: 35.6852 },
    attractions: [
      { name: "Shinjuku Gyoen", nameJa: "新宿御苑", nameHe: "גויאן גארדנס", desc: "היה מעולה, ראינו סקורות — גן יפני מדהים", coordinates: { lng: 139.7100, lat: 35.6852 } },
      { name: "Shinjuku", nameJa: "新宿", nameHe: "שינג'וקו", desc: "הסתובבנו באזור, אווירה מטורפת", coordinates: { lng: 139.7005, lat: 35.6896 } },
      { name: "Golden Gai", nameJa: "ゴールデン街", nameHe: "גולדן גאי", desc: "מקום קטן של 4 אנשים, אכלנו מרק — מעולה!", coordinates: { lng: 139.7042, lat: 35.6938 } },
    ],
    lunch: { place: "FUUNJI", nameJa: "風雲児", nameHe: "פואונג'י", desc: "ראמן מבוסס חזיר בשינג'וקו, יחסית כבד אבל טעים לאוהבי הראמנים הכבדים. ציון: 8.5/10", rating: "8.5/10", coordinates: { lng: 139.6985, lat: 35.6895 } },
    dinner: { place: "Golden Gai Bar", nameJa: "ゴールデン街", nameHe: "גולדן גאי", desc: "מרק ושתייה בבר קטנטן ואינטימי. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.7042, lat: 35.6938 } },
    tips: ["גולדן גאי — לבוא מוקדם (19:30) כשזה פנוי", "SHIN ODON — צריך פתק, המתנה שעה וחצי", "FUUNJI — אלטרנטיבה מצוינת"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "ראמן FUUNJI, גולדן גאי" }, images: [],
  },
  {
    day: 3, title: "יום 3 - דיסנילנד", city: "Tokyo Disney", cityHe: "טוקיו (דיסנילנד)",
    coordinates: { lng: 139.8814, lat: 35.6329 },
    attractions: [
      { name: "Monsters Inc.", nameJa: "モンスターズ・インク", nameHe: "מפלצות בע״מ", desc: "ריצה למתקן ראשון — 10/10", coordinates: { lng: 139.8801, lat: 35.6340 } },
      { name: "Beauty and the Beast", nameJa: "美女と野獣", nameHe: "יפה והחיה", desc: "כרטיס פריוריטי בתשלום — שווה", coordinates: { lng: 139.8788, lat: 35.6350 } },
      { name: "Buzz Lightyear", nameJa: "バズ・ライトイヤー", nameHe: "באז שנות אור", desc: "פריוריטי חינם — לבקש! 10/10", coordinates: { lng: 139.8835, lat: 35.6325 } },
      { name: "Space Mountain", nameJa: "スペースマウンテン", nameHe: "ספייס מאונטיין", desc: "10/10 — רכבת הרים בחושך", coordinates: { lng: 139.8818, lat: 35.6357 } },
      { name: "Splash Mountain", nameJa: "スプラッシュマウンテン", nameHe: "ספלאש מאונטיין", desc: "8/10 — תור שעה וחצי מוסתר בתוך ההר", coordinates: { lng: 139.8782, lat: 35.6336 } },
      { name: "Haunted Mansion", nameJa: "ホーンテッドマンション", nameHe: "בית רדוף רוחות", desc: "9/10 — פריוריטי דרך האפליקציה", coordinates: { lng: 139.8796, lat: 35.6318 } },
      { name: "Pirates of the Caribbean", nameJa: "カリブの海賊", nameHe: "שודדי הקאריביים", desc: "8/10 — קלאסיקה", coordinates: { lng: 139.8780, lat: 35.6312 } },
    ],
    lunch: { place: "Grandma Sara's Kitchen", nameJa: "グランマ・サラのキッチン", nameHe: "מטבח של סבתא", desc: "אכלנו צהריים בפארק", rating: "6/10", coordinates: { lng: 139.8810, lat: 35.6335 } },
    dinner: { place: "Konbini", nameJa: "コンビニ", nameHe: "קונביני ליד המלון", desc: "השלמות בקונביני — מושלם וזול", rating: "7/10", coordinates: { lng: 139.8836, lat: 35.6370 } },
    tips: ["לצאת מוקדם (06:15)!", "לקנות פריוריטי בתשלום למתקנים פופולריים", "לבקש פריוריטי חינם לבאז"],
    hotel: "HOTEL MYSTAYS Maihama", expenses: { accommodation: "590 ₪", highlights: "דיסנילנד — 900 ₪" }, images: [],
  },
  {
    day: 4, title: "יום 4 - דיסני סי", city: "Tokyo DisneySea", cityHe: "טוקיו (דיסני סי)",
    coordinates: { lng: 139.8894, lat: 35.6267 },
    attractions: [
      { name: "Soaring: Fantastic Flight", nameJa: "ソアリン：ファンタスティック・フライト", nameHe: "סוארינג פלייט", desc: "תור של שעתיים ב-09:03", coordinates: { lng: 139.8870, lat: 35.6260 } },
      { name: "Journey to the Center of the Earth", nameJa: "センター・オブ・ジ・アース", nameHe: "מסע למרכז כדור הארץ", desc: "שווה!", coordinates: { lng: 139.8882, lat: 35.6248 } },
      { name: "Indiana Jones", nameJa: "インディ・ジョーンズ", nameHe: "אינדיאנה ג'ונס", desc: "מתקן מעולה", coordinates: { lng: 139.8898, lat: 35.6252 } },
      { name: "Little Mermaid Lagoon", nameJa: "マーメイドラグーン", nameHe: "לגונת בת הים", desc: "10/10 — הפתעה מטורפת ביחס לציפיות!", coordinates: { lng: 139.8862, lat: 35.6278 } },
      { name: "20,000 Leagues Under the Sea", nameJa: "海底2万マイル", nameHe: "20,000 ליגות מתחת למים", desc: "8/10 — פריוריטי חינמי", coordinates: { lng: 139.8890, lat: 35.6242 } },
      { name: "Tower of Terror", nameJa: "タワー・オブ・テラー", nameHe: "מגדל האימה", desc: "10/10!", coordinates: { lng: 139.8915, lat: 35.6282 } },
      { name: "Toy Story Mania", nameJa: "トイ・ストーリー・マニア", nameHe: "טוי סטורי מאניה", desc: "⚠️ סגור בביקור — המתקן לא היה זמין באותו יום", status: "closed", coordinates: { lng: 139.8920, lat: 35.6275 } },
    ],
    lunch: { place: "DisneySea Restaurant", nameJa: "ディズニーシーレストラン", nameHe: "מסעדה בדיסני סי", desc: "אכלנו תוך כדי סיבוב", rating: "6/10", coordinates: { lng: 139.8890, lat: 35.6265 } },
    dinner: { place: "Ichiran Ramen Shinjuku", nameJa: "一蘭 新宿", nameHe: "איצ'ירן ראמן שינג'וקו", desc: "ראמן מבוסס ציר חזיר. מאוד טעים (מומלץ לקחת אסטרה איטריות באמצע הארוחה). ציון: 10/10", rating: "10/10", coordinates: { lng: 139.7004, lat: 35.6926 } },
    tips: ["להגיע לפני 07:00!", "הפארק נפתח 07:30 — לרוץ ישר", "איצ'ירן ראמן — חובה אחרי הפארק"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "דיסני סי, איצ'ירן ראמן" }, images: [],
  },
  {
    day: 5, title: "יום 5 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7016, lat: 35.6595 },
    attractions: [
      { name: "Little Darling Coffee Roasters", nameJa: "リトルダーリンコーヒーロースターズ", nameHe: "ליטל דרלינג קופי", desc: "בית קפה מעוצב ברופונגי. ציון: 8/10", coordinates: { lng: 139.7316, lat: 35.6588 } },
      { name: "Shibuya — Hachiko", nameJa: "渋谷 ハチ公像", nameHe: "שיבויה — פסל האצ'יקו", desc: "פסל האצ'יקו, חנויות", coordinates: { lng: 139.7006, lat: 35.6590 } },
      { name: "PARCO Shibuya (Pokemon Center)", nameJa: "パルコ 渋谷（ポケモンセンター）", nameHe: "פארקו (מרכז פוקימון)", desc: "קניון עם Pokemon Center, נעלי נייקי", coordinates: { lng: 139.6977, lat: 35.6616 } },
      { name: "Uogashi Nihon-Ichi Shibuya Dogenzaka", nameJa: "魚がし日本一 渋谷道玄坂店", nameHe: "אוגאשי ניהון-איצ'י שיבויה דוגנזאקה", desc: "סושי בעמידה בשיבויה, חוויה אינטימית מול השף. ציון: 8.5/10", coordinates: { lng: 139.6995, lat: 35.6600 } },
      { name: "Omoide Yokocho", nameJa: "思い出横丁", nameHe: "אומוידה יוקוצ'ו (רחוב הזיכרונות)", desc: "רחוב מנורות ואיזיקאיות — מהמם!", coordinates: { lng: 139.6985, lat: 35.6935 } },
      { name: "3D Billboard Shinjuku", nameJa: "新宿3D大型ビジョン", nameHe: "מסך 3D שינג'וקו", desc: "ממש מגניב", coordinates: { lng: 139.7012, lat: 35.6912 } },
    ],
    lunch: { place: "Little Darling Coffee", nameJa: "リトルダーリンコーヒー", nameHe: "ליטל דרלינג קופי", desc: "בית קפה מעוצב ברופונגי. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.7316, lat: 35.6588 } },
    dinner: { place: "Izakaya at Omoide Yokocho", nameJa: "居酒屋 思い出横丁", nameHe: "איזיקאיה ברחוב הזיכרונות", desc: "שיפודים (איזקאיה) בסמטת המנורות בשינג'וקו. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.6985, lat: 35.6935 } },
    tips: ["Little Darling Coffee — מושלם ברופונגי", "Omoide Yokocho — לבוא בערב", "קפה יוזו — אל תנסו!"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "Little Darling, Omoide Yokocho" }, images: [],
  },
  {
    day: 6, title: "יום 6 - קנזוואה", city: "Kanazawa", cityHe: "קנזוואה",
    coordinates: { lng: 136.6256, lat: 36.5613 },
    attractions: [
      { name: "Shinkansen to Kanazawa", nameJa: "北陸新幹線 金沢行き", nameHe: "שינקנסן לקנזוואה", desc: "רכבת ב-09:56, שעתיים וחצי — חוויה", coordinates: { lng: 139.7673, lat: 35.6812 } },
      { name: "Omicho Fish Market", nameJa: "近江町市場", nameHe: "שוק הדגים אומיצ'ו", desc: "בשר A5 על ניגירי, סושי מצוין — שוק ענק עם מאות דוכנים", coordinates: { lng: 136.6579, lat: 36.5720 } },
      { name: "Kenroku-en Garden", nameJa: "兼六園", nameHe: "גן קנרוקואן", desc: "אחד משלושת הגנים היפים ביפן — תמונות מטורפות", coordinates: { lng: 136.6628, lat: 36.5621 } },
      { name: "Kanazawa Castle", nameJa: "金沢城", nameHe: "טירת קנזוואה", desc: "הטירה המפורסמת, גלידת זהב — יפה מאוד", coordinates: { lng: 136.6615, lat: 36.5633 } },
    ],
    lunch: { place: "Omicho Fish Market Sushi", nameJa: "近江町市場 寿司", nameHe: "סושי בשוק אומיצ'ו", desc: "סושי טרי ובשר A5 על ניגירי בשוק הדגים. ציון: 9/10", rating: "9/10", coordinates: { lng: 136.6579, lat: 36.5720 } },
    dinner: { place: "Mazesoba Restaurant", nameJa: "まぜそば", nameHe: "מסעדת מאזסובה", desc: "איטריות ללא מרק עם רוטב שמן זית וצ'ילי, טעים מאוד ומרענן. ציון: 8.5/10", rating: "8.5/10", coordinates: { lng: 136.6492, lat: 36.5778 } },
    tips: ["שינקנסן — להזמין מראש!", "Hotel Kanazawa Zoushi — ממליצים בחום", "Mazesoba — שווה לנסות"],
    hotel: "Hotel Kanazawa Zoushi", expenses: { accommodation: "535 ₪", highlights: "שינקנסן, mazesoba" }, images: [],
  },
  {
    day: 7, title: "יום 7 - טקיאמה", city: "Takayama", cityHe: "טקיאמה",
    coordinates: { lng: 137.2531, lat: 36.1461 },
    attractions: [
      { name: "Shirakawa-go", nameJa: "白川郷", nameHe: "שירקגאו", desc: "כפר מסורתי מהמם — שיחקנו בשלג!", coordinates: { lng: 136.9061, lat: 36.2578 } },
      { name: "Shirakawago Purin no Ie", nameJa: "白川郷プリンの家", nameHe: "פודינג של שירקאוואגו", desc: "אכלנו בכפר — טוב!", coordinates: { lng: 136.9063167, lat: 36.2561007 } },
    ],
    lunch: { place: "Keyaki (Ramen)", nameJa: "ケヤキ", nameHe: "קיאקי — סובה בשירקגאו", desc: "סובה מוצלח מאוד, קליל וטעים. ציון: 8/10", rating: "8/10", coordinates: { lng: 136.9065735, lat: 36.2592114 } },
    dinner: { place: "Takumiya Yasukawa", nameJa: "匠家 安川", nameHe: "טאקומיה יאסוקאווה — סובה", desc: "מסעדת סובה (אטריות כוסמת) מעולה — גם לצמחונים וגם לשרימפס. ציון: 9.2/10", rating: "9.2/10", coordinates: { lng: 137.259342, lat: 36.1436573 } },
    tips: ["שירקגאו — שווה ביום שלגי", "אוטובוס 09:10, שעה ורבע", "הסובה בטקיאמה — חובה!"],
    hotel: "Residence Hotel Takayama Station", expenses: { accommodation: "209 ₪", highlights: "שירקגאו, סובה" }, images: [],
  },
  {
    day: 8, title: "יום 8 - מטסומוטו", city: "Matsumoto", cityHe: "מטסומוטו",
    coordinates: { lng: 137.9721, lat: 36.2381 },
    attractions: [
      { name: "Hiryu Ski Resort", nameJa: "飛騨ほおのき平スキー場", nameHe: "אתר סקי היריו", desc: "סקי וסנובורד! שיעור פרטי — מושלם", coordinates: { lng: 137.1968, lat: 36.2258 } },
      { name: "Hirayu no Mori Onsen", nameJa: "ひらゆの森", nameHe: "אונסן היראיו נו מורי", desc: "אונסן + מיטת מסאג' + כביסה", coordinates: { lng: 137.5511401, lat: 36.1889556 } },
    ],
    lunch: { place: "Hirayu Onsen Ski Area", nameJa: "平湯温泉スキー場", nameHe: "מסעדה באתר הסקי היראיו", desc: "אכלנו באזור ההר", rating: "—", coordinates: { lng: 137.5528597, lat: 36.1847589 } },
    dinner: { place: "McDonald's Matsumoto", nameJa: "マクドナルド 松本", nameHe: "מקדונלדס מטסומוטו", desc: "המבורגר שרימפס מיוחד ליפן. ציון: 6/10", rating: "6/10", coordinates: { lng: 137.9710, lat: 36.2340 } },
    tips: ["היריו — שווה לעצור בדרך", "שיעור סקי פרטי — ממליצים", "אונסן — מרגיע אחרי סקי"],
    hotel: "Tabino Hotel lit Matsumoto", expenses: { accommodation: "280 ₪", highlights: "סקי + סנובורד, אונסן" }, images: [],
  },
  {
    day: 9, title: "יום 9 - נגויה", city: "Nagoya", cityHe: "נגויה",
    coordinates: { lng: 136.9066, lat: 35.1815 },
    attractions: [
      // Morning was in Matsumoto — flagged so the Matsumoto city
      // filter surfaces these even though the night was Nagoya.
      { name: "Matsumoto Castle", nameJa: "松本城", nameHe: "טירת מטסומוטו", desc: "טירה יפנית יפה מאוד", coordinates: { lng: 137.9688, lat: 36.2388 }, city: "Matsumoto", cityHe: "מטסומוטו" },
      { name: "Kusama Yayoi Museum", nameJa: "松本市美術館（草間彌生）", nameHe: "מוזיאון יויו כוסאמה", desc: "מאוד יפה, שווה", coordinates: { lng: 137.9758, lat: 36.2336 }, city: "Matsumoto", cityHe: "מטסומוטו" },
    ],
    lunch: { place: "Michelin Café", nameJa: "ミシュランカフェ 松本", nameHe: "בית קפה מישלן", desc: "פראנץ' טוסט מטורף — המלצת זהב!", rating: "9.5/10", coordinates: { lng: 137.9700, lat: 36.2350 }, city: "Matsumoto", cityHe: "מטסומוטו" },
    dinner: { place: "Shishimaru Ramen", nameJa: "獅子丸", nameHe: "שישימארו ראמן", desc: "המלצת זהב מאפליקציית Ramen Beast. ראמן מבוסס לובסטר מוקצף (הכפתור האדום במכונה) — הראמן הכי טעים שאכלנו ביפן. ציון: 10/10", rating: "10/10", coordinates: { lng: 136.8826, lat: 35.1706 } },
    tips: ["בית קפה — פראנץ' טוסט מטורף", "Shishimaru — ראמן המלצת זהב!", "JR נסיעה נוחה"],
    hotel: "Daiwa Roynet Hotel Nagoya", expenses: { accommodation: "314 ₪", highlights: "טירת מטסומוטו, Shishimaru" }, images: [],
  },
  {
    day: 10, title: "יום 10 - אוסקה", city: "Osaka", cityHe: "אוסקה",
    coordinates: { lng: 135.5023, lat: 34.6937 },
    attractions: [
      { name: "Osaka Castle", nameJa: "大阪城", nameHe: "טירת אוסקה", desc: "טירה + הגן — מאוד נחמד", coordinates: { lng: 135.5256, lat: 34.6873 } },
      { name: "Food Tour with Liran", nameJa: "フードツアー", nameHe: "סיור אוכל עם לירן", desc: "ישראלי שגר באוסקה 20 שנה — אחלה!", coordinates: { lng: 135.5013, lat: 34.6687 } },
      { name: "Karaoke Night", nameJa: "カラオケナイト", nameHe: "ערב קריוקי", desc: "סיימנו את הערב בקריוקי — אחרי סיור האוכל", coordinates: { lng: 135.5020, lat: 34.6685 } },
    ],
    lunch: { place: "Ramen Hayato", nameJa: "ラーメン隼人", nameHe: "ראמן האיאטו", desc: "ראמן מיסו מיוחד עם חוקים נוקשים (אסור בושם, אסור לצלם, אסור לדבר) — השף אלרגי לדאודורנט. ציון: 9/10", rating: "9/10", coordinates: { lng: 135.5060, lat: 34.6850 } },
    dinner: { place: "Food Tour", nameJa: "フードツアー", nameHe: "סיור אוכל עם לירן", desc: "סיור מ-17:30", rating: "8.5/10", coordinates: { lng: 135.5013, lat: 34.6687 } },
    tips: ["סיור אוכל עם לירן — ממליצים בחום", "ראמן Hayato — חוויה מעולה"],
    hotel: "Granbell Hotel Osaka", expenses: { accommodation: "1,245 ₪ (4 לילות)", highlights: "טירת אוסקה, Hayato, סיור אוכל" }, images: [],
  },
  {
    day: 11, title: "יום 11 - יוניברסל", city: "Osaka Universal", cityHe: "אוסקה (יוניברסל)",
    coordinates: { lng: 135.4323, lat: 34.6654 },
    attractions: [
      { name: "Super Nintendo World", nameJa: "スーパー・ニンテンドー・ワールド", nameHe: "עולם נינטנדו (מריו)", desc: "9/10 — מהמם", coordinates: { lng: 135.4310, lat: 34.6670 } },
      { name: "Flying Dinosaur", nameJa: "ザ・フライング・ダイナソー", nameHe: "הדינוזאור המעופף", desc: "10/10 עם Fast Pass — רכבת הרים מטורפת, מה לא עושים בשביל זוגיות!", coordinates: { lng: 135.4318, lat: 34.6642 } },
      { name: "XR Dreamor", nameJa: "XRドリーモア", nameHe: "XR דרימור", desc: "חוויית VR מטורפת — SLAY!", coordinates: { lng: 135.4325, lat: 34.6650 } },
      { name: "Wizarding World of Harry Potter", nameJa: "ハリー・ポッター", nameHe: "עולם הארי פוטר", desc: "לחובבי הארי פוטר זה מושלם 10/10", coordinates: { lng: 135.4290, lat: 34.6680 } },
      { name: "JAWS", nameJa: "ジョーズ", nameHe: "ג'ואס (לסתות)", desc: "6/10 — חביב", coordinates: { lng: 135.4335, lat: 34.6665 } },
    ],
    lunch: { place: "Universal Studios", nameJa: "ユニバーサル・スタジオ", nameHe: "בתוך הפארק", desc: "אכלנו תוך כדי", rating: "—", coordinates: { lng: 135.4323, lat: 34.6654 } },
    dinner: { place: "Kura Sushi (Conveyor Belt)", nameJa: "くら寿司（回転寿司）", nameHe: "קורה סושי — סושי על מסוע", desc: "סושי מסוע זול. באוסקה היה בסדר. ציון: 7/10", rating: "7/10", coordinates: { lng: 135.4380, lat: 34.6700 } },
    tips: ["להגיע ל-06:30!", "Mario World — ראשון!", "FAST PASS שווה"],
    hotel: "Granbell Hotel Osaka", expenses: { accommodation: "כלול", highlights: "Universal + FAST PASS — 1,500 ₪" }, images: [],
  },
  {
    day: 12, title: "יום 12 - אוסקה", city: "Osaka", cityHe: "אוסקה",
    coordinates: { lng: 135.5013, lat: 34.6687 },
    attractions: [
      { name: "Namba Yasaka Shrine", nameJa: "難波八阪神社", nameHe: "מקדש נמבה יאסאקה", desc: "מקדש מיוחד ויפה", coordinates: { lng: 135.4969, lat: 34.6622 } },
      { name: "Kuromon Ichiba Market", nameJa: "黒門市場", nameHe: "שוק קורומון איצ'יבה", desc: "שוק דגים מרשים, טעימות מדהימות. ציון: 8.5/10", coordinates: { lng: 135.5073, lat: 34.6680 } },
      { name: "Dotonbori", nameJa: "道頓堀", nameHe: "דוטונבורי", desc: "יפה בלילה, מלא אורות", coordinates: { lng: 135.5013, lat: 34.6687 } },
      { name: "Round1 Arcade", nameJa: "ラウンドワン", nameHe: "ראונד1 ארקייד", desc: "4 שעות בארקייד רב-קומתי — יואב התלהב, למיכלי קצת רעש", coordinates: { lng: 135.5028, lat: 34.6692 } },
    ],
    lunch: { place: "Kuromon Ichiba Market", nameJa: "黒門市場", nameHe: "שוק קורומון", desc: "שוק דגים מרשים, טעימות מדהימות. ציון: 8.5/10", rating: "8.5/10", coordinates: { lng: 135.5073, lat: 34.6680 } },
    dinner: { place: "Ichiran Ramen Dotonbori", nameJa: "一蘭 道頓堀", nameHe: "איצ'ירן ראמן דוטונבורי", desc: "ראמן מבוסס ציר חזיר. מאוד טעים (מומלץ לקחת אסטרה איטריות באמצע הארוחה). ציון: 10/10", rating: "10/10", coordinates: { lng: 135.5020, lat: 34.6690 } },
    tips: ["Namba Yasaka — שווה צילום", "Kuromon Market — שוק מרשים", "Dotonbori — לבוא בלילה"],
    hotel: "Granbell Hotel Osaka", expenses: { accommodation: "כלול", highlights: "Kuromon, איצ'ירן" }, images: [],
  },
  {
    day: 13, title: "יום 13 - נארה", city: "Nara", cityHe: "נארה",
    coordinates: { lng: 135.8048, lat: 34.6851 },
    attractions: [
      { name: "Nara Park & Deer", nameJa: "奈良公園・鹿", nameHe: "פארק נארה והאיילים", desc: "מלא איילים — נפלא!", coordinates: { lng: 135.8398, lat: 34.6851 } },
      { name: "Todai-ji Temple", nameJa: "東大寺（大仏）", nameHe: "מקדש טודאי-ג'י (בודהה הגדול)", desc: "הפסל יפהפה — אבל לא חובה אם הזמן קצר", coordinates: { lng: 135.8398, lat: 34.6891 } },
    ],
    lunch: { place: "Ramen in Nara", nameJa: "奈良ラーメン", nameHe: "ראמן בנארה", desc: "ראמן באזור", rating: "7/10", coordinates: { lng: 135.8310, lat: 34.6840 } },
    dinner: { place: "—", nameJa: "", nameHe: "", desc: "", rating: "—", coordinates: null },
    tips: ["נארה — לבוא מוקדם", "טודאי-ג'י — הפסל יפה אבל לא חובה אם הזמן קצר", "יום קל מאוסקה"],
    hotel: "Granbell Hotel Osaka", expenses: { accommodation: "כלול", highlights: "נארה — חינם" }, images: [],
  },
  {
    day: 14, title: "יום 14 - קיוטו", city: "Kyoto", cityHe: "קיוטו",
    coordinates: { lng: 135.7681, lat: 35.0116 },
    attractions: [
      { name: "Maruyama Park", nameJa: "円山公園", nameHe: "גן מריומה", desc: "גן יפה, מקדשים", coordinates: { lng: 135.7808, lat: 35.0033 } },
    ],
    lunch: { place: "GION DUCK", nameJa: "ぎをん鴨川", nameHe: "גיון דאק (ברווז)", desc: "ראמן מבוסס ציר ברווז עדין ומיוחד עם סוגים שונים של יוזו. ציון: 9/10", rating: "9/10", coordinates: { lng: 135.7756, lat: 35.0036 } },
    dinner: { place: "Gyoza Motoi", nameJa: "餃子もとい", nameHe: "גיוזה מוטוי", desc: "מסעדת גיוזה מומלצת מישלן, מעט יקרה. ציון: 8/10", rating: "8/10", coordinates: { lng: 135.7615, lat: 35.0060 } },
    tips: ["Gyoza Motoi — מישלן, שווה", "גן מריומה — יפה מאוד"],
    hotel: "Hotel Resol Kyoto Shijo Muromachi", expenses: { accommodation: "2,600 ₪ (5 לילות)", highlights: "Gyoza Motoi, גן מריומה" }, images: [],
  },
  {
    day: 15, title: "יום 15 - קיוטו", city: "Kyoto", cityHe: "קיוטו",
    coordinates: { lng: 135.7727, lat: 34.9671 },
    attractions: [
      { name: "Fushimi Inari Shrine", nameJa: "伏見稲荷大社", nameHe: "פושימי אינארי (מקדש השערים)", desc: "הגענו 07:30, עלינו עד לפסגה!", coordinates: { lng: 135.7727, lat: 34.9671 } },
      { name: "Ogawa Coffee", nameJa: "小川珈琲", nameHe: "אוגאווה קפה", desc: "מצוין לאוהבי קפה", coordinates: { lng: 135.7640, lat: 35.0048 } },
      { name: "Nishiki Market", nameJa: "錦市場", nameHe: "נישיקי מארקט", desc: "שוק עם אווירה וטעימות. ציון: 8/10", coordinates: { lng: 135.7645, lat: 35.0050 } },
    ],
    lunch: { place: "Nishiki Market", nameJa: "錦市場", nameHe: "נישיקי מארקט", desc: "שוק עם אווירה וטעימות. ציון: 8/10", rating: "8/10", coordinates: { lng: 135.7645, lat: 35.0050 } },
    dinner: { place: "Burger Revolution Kyoto", nameJa: "バーガーレボリューション 京都", nameHe: "בורגר רבולושן קיוטו", desc: "המבורגר איכותי ומצוין. ציון: 8/10", rating: "8/10", coordinates: { lng: 135.7620, lat: 35.0055 } },
    tips: ["פושימי אינארי — ב-07:30, כמעט ריק!", "לעלות לפסגה — שווה", "Ogawa Coffee — מצוין"],
    hotel: "Hotel Resol Kyoto Shijo Muromachi", expenses: { accommodation: "כלול", highlights: "Ogawa Coffee, Burger Revolution" }, images: [],
  },
  {
    day: 16, title: "יום 16 - קיוטו (מנוחה)", city: "Kyoto", cityHe: "קיוטו",
    coordinates: { lng: 135.7556, lat: 35.0032 },
    attractions: [
      { name: "Stumptown Coffee Roasters", nameJa: "スタンプタウン コーヒー", nameHe: "סטאמפטאון קופי רוסטרס", desc: "קפה מעולה באווירה שמתאימה לעבודה עם לפטופ. ציון: 7/10", coordinates: { lng: 135.7601108, lat: 35.0097689 } },
      { name: "Bar Elcanture", nameJa: "バー エルカンチュール", nameHe: "בר אלקנטור", desc: "בר מומלץ מאוד!!", coordinates: { lng: 135.7650, lat: 35.0030 } },
    ],
    lunch: { place: "Café", nameJa: "カフェ", nameHe: "בית קפה", desc: "קפה ועוגות", rating: "7/10", coordinates: { lng: 135.7600, lat: 35.0045 } },
    dinner: { place: "—", nameJa: "", nameHe: "", desc: "יום מנוחה", rating: "—", coordinates: null },
    tips: ["יום גשום — הזדמנות לנוח", "לבדוק הזמנות מראש לברים"],
    hotel: "Hotel Resol Kyoto Shijo Muromachi", expenses: { accommodation: "כלול", highlights: "יום מנוחה" }, images: [],
  },
  {
    day: 17, title: "יום 17 - קיוטו", city: "Kyoto", cityHe: "קיוטו",
    coordinates: { lng: 135.7292, lat: 35.0394 },
    attractions: [
      { name: "Arashiyama Bamboo Grove", nameJa: "嵐山竹林の小径", nameHe: "יער הבמבוקים אראשיאמה", desc: "הגענו 07:15, קצת אובר רייטד אבל שווה", coordinates: { lng: 135.6713, lat: 35.0154 } },
      { name: "Kinkaku-ji (Golden Pavilion)", nameJa: "金閣寺", nameHe: "קינקאקו-ג'י (מקדש הזהב)", desc: "מאוד יפה!", coordinates: { lng: 135.7292, lat: 35.0394 } },
      { name: "Hokanji Pagoda", nameJa: "法観寺 八坂の塔", nameHe: "הוקאנג'י (פגודת יאסאקה)", desc: "הצטלמנו בערב", coordinates: { lng: 135.7811, lat: 34.9979 } },
    ],
    lunch: { place: "Ramen Kyoto", nameJa: "京都ラーメン", nameHe: "ראמן במרכז קיוטו", desc: "חיפשנו ראמן טוב", rating: "7/10", coordinates: { lng: 135.7600, lat: 35.0050 } },
    dinner: { place: "PIZZA MIRITA", nameJa: "ピッツァ ミリタ", nameHe: "פיצה מיריטה", desc: "פיצה מוצלחת בערב עם חברים. ציון: 8.5/10", rating: "8.5/10", coordinates: { lng: 135.7690, lat: 35.0020 } },
    tips: ["יער הבמבוקים — ב-07:00", "Kinkaku-ji — יפה!", "Hokanji — לצלם בערב"],
    hotel: "Hotel Resol Kyoto Shijo Muromachi", expenses: { accommodation: "כלול", highlights: "Kinkaku-ji, Pizza Mirita" }, images: [],
  },
  {
    day: 18, title: "יום 18 - קיוטו", city: "Kyoto", cityHe: "קיוטו",
    coordinates: { lng: 135.7811, lat: 34.9979 },
    attractions: [
      { name: "Hokanji Morning Photos", nameJa: "法観寺 朝の撮影", nameHe: "הוקאנג'י — צילומי בוקר", desc: "הגענו 07:20 — לבוא לפני 08:00!", coordinates: { lng: 135.7811, lat: 34.9979 } },
      { name: "Starbucks Ninenzaka", nameJa: "スターバックス 二寧坂", nameHe: "סטארבקס נינאנזאקה", desc: "סניף מיוחד בבית מסורתי עם ישיבה על מחצלות טאטאמי", coordinates: { lng: 135.7804, lat: 34.9984 } },
      { name: "UZU Ramen (teamLab)", nameJa: "UZU ラーメン（チームラボ）", nameHe: "אוזו ראמן (טים-לאב)", desc: "Team Lab + ראמן צמחוני טעים ברמות. ציון: 10/10", coordinates: { lng: 135.7690, lat: 35.0020 } },
    ],
    lunch: { place: "—", nameJa: "", nameHe: "", desc: "מנוחה במלון", rating: "—", coordinates: null },
    dinner: { place: "UZU Ramen (teamLab)", nameJa: "UZU ラーメン（チームラボ）", nameHe: "אוזו ראמן (טים-לאב)", desc: "Team Lab + ראמן צמחוני טעים ברמות. ציון: 10/10", rating: "10/10", coordinates: { lng: 135.7690, lat: 35.0020 } },
    tips: ["Hokanji — לפני 07:00!", "UZU RAMEN — חובה!", "סטארבקס Ninenzaka — חוויה"],
    hotel: "Hotel Resol Kyoto Shijo Muromachi", expenses: { accommodation: "כלול", highlights: "UZU RAMEN — 10/10" }, images: [],
  },
  {
    day: 19, title: "יום 19 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7312, lat: 35.6622 },
    attractions: [
      { name: "Shinkansen to Tokyo", nameJa: "東海道新幹線 東京行き", nameHe: "שינקנסן לטוקיו", desc: "רכבת של 10:00", coordinates: { lng: 135.7584, lat: 34.9858 } },
      { name: "Harajuku", nameJa: "原宿", nameHe: "הראג'וקו", desc: "חזרנו לאזור האהוב", coordinates: { lng: 139.7074, lat: 35.6693 } },
      { name: "Shimokitazawa", nameJa: "下北沢", nameHe: "שימוקיטזאווה", desc: "חנויות יד שנייה — שווה!", coordinates: { lng: 139.6682, lat: 35.6614 } },
    ],
    lunch: { place: "AFURI Harajuku", nameJa: "阿夫利 原宿", nameHe: "אפורי האראג'וקו", desc: "ראמן עוף מבוסס יוזו. יש גם אופציה לטבעוני. אמאלה! ציון: 9/10", rating: "9/10", coordinates: { lng: 139.7054, lat: 35.6691 } },
    dinner: { place: "Nakame Shumai Bar Shimokitazawa", nameJa: "中目シュウマイ酒場 下北沢店", nameHe: "נאקאמה שומאי בר שימוקיטזאווה", desc: "בר שומאי (כיסונים מאודים) בשימוקיטזאווה. ציון: 7.5/10", rating: "7.5/10", coordinates: { lng: 139.6674209, lat: 35.6605946 } },
    tips: ["שינקנסן — להזמין שבוע מראש לצד פוג'י!", "Shimokitazawa — לבוא בצהריים"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "2,660 ₪ (4 לילות)", highlights: "שינקנסן, Shimokitazawa" }, images: [],
  },
  {
    day: 20, title: "יום 20 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7714, lat: 35.7141 },
    attractions: [
      { name: "Ueno Park", nameJa: "上野公園", nameHe: "פארק אואנו", desc: "פיקניק — יפה מאוד", coordinates: { lng: 139.7745, lat: 35.7141 } },
      { name: "Toy Store (Ptitim rec.)", nameJa: "おもちゃ屋", nameHe: "חנות צעצועים (המלצת פתיתים)", desc: "מוצלח מאוד!", coordinates: { lng: 139.7730, lat: 35.7120 } },
      { name: "Ueno Ameyoko Market", nameJa: "アメ横商店街", nameHe: "שוק אמיוקו אואנו", desc: "נעליים ודברים שווים", coordinates: { lng: 139.7745, lat: 35.7100 } },
      { name: "Kappabashi Street", nameJa: "かっぱ橋道具街", nameHe: "רחוב קפאבאשי (כלי מטבח)", desc: "רחוב כלי מטבח — צריך 2-3 שעות, שווה מאוד!", coordinates: { lng: 139.7904, lat: 35.7148 } },
    ],
    lunch: { place: "Picnic at Ueno Park", nameJa: "上野公園ピクニック", nameHe: "פיקניק בפארק אואנו", desc: "אכלנו בפארק", rating: "8/10", coordinates: { lng: 139.7745, lat: 35.7141 } },
    dinner: { place: "—", nameJa: "", nameHe: "", desc: "עייפים, ביטלנו סיור", rating: "—", coordinates: null },
    tips: ["פארק Ueno — מושלם לפיקניק", "חנות צעצועים בהמלצת פתיתים — שווה!"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "Ueno, שוק, צעצועים" }, images: [],
  },
  {
    day: 21, title: "יום 21 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7006, lat: 35.6581 },
    attractions: [
      { name: "Katsuobushi Shibuya", nameJa: "かつお食堂 渋谷", nameHe: "קצובושי שיבויה", desc: "ארוחת בוקר של שבבי דג בוניטו על אורז. יואב אהב, מיכלי פחות", coordinates: { lng: 139.6978, lat: 35.6605 } },
      { name: "Akihabara", nameJa: "秋葉原", nameHe: "אקיהבארה", desc: "גן עדן לאנימה!", coordinates: { lng: 139.7731, lat: 35.6984 } },
      { name: "Super Potato", nameJa: "スーパーポテト", nameHe: "סופר פוטאטו", desc: "משחקי רטרו — חביב", coordinates: { lng: 139.7714, lat: 35.6988 } },
      { name: "Radio Kaikan", nameJa: "ラジオ会館", nameHe: "רדיו קאיקאן", desc: "10 קומות אנימה!", coordinates: { lng: 139.7710, lat: 35.6985 } },
    ],
    lunch: { place: "Tsukemen Gonokami Seisakusho Shinjuku", nameJa: "五ノ神製作所 新宿", nameHe: "צוקמן גונוקאמי — שינג'וקו", desc: "ראמן טבילה (Tsukemen) מבוסס שרימפס. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.7038616, lat: 35.687351 } },
    dinner: { place: "LAWSON Minato Roppongi Dori", nameJa: "ローソン 港六本木通り店", nameHe: "לוסון — רופונגי", desc: "גמורים, ארוחת קונביני", rating: "6/10", coordinates: { lng: 139.7293252, lat: 35.6621188 } },
    tips: ["קצובושי — ב-08:00, שעה וחצי תור", "אקיהבארה — חצי יום", "סופר פוטאטו + RADIO KAIKAN — חובה"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "קצובושי, אקיהבארה" }, images: [],
  },
  {
    day: 22, title: "יום 22 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7745, lat: 35.6268 },
    attractions: [
      { name: "teamLab Planets", nameJa: "チームラボプラネッツ", nameHe: "טים-לאב פלנטס", desc: "מושלם! להזמין הכי מוקדם", coordinates: { lng: 139.7843, lat: 35.6525 } },
      { name: "Odaiba — Gundam", nameJa: "お台場 ガンダム", nameHe: "אודייבה — פסל גאנדם", desc: "חביב, לא הפסל שזז (הגאנדם זזז נמצא במפעל רחוק)", coordinates: { lng: 139.7745, lat: 35.6268 } },
      { name: "Electric Go-Kart Odaiba", nameJa: "電動ゴーカート", nameHe: "גו-קארט חשמלי", desc: "1,500 ל-4 דקות, מומלץ 7 סיבובים ב-3,500", coordinates: { lng: 139.7700, lat: 35.6280 } },
      { name: "Ginza Uniqlo (12 Floors)", nameJa: "ユニクロ 銀座", nameHe: "יוניקלו גינזה (12 קומות)", desc: "12 קומות של יוניקלו! חנות הדגל", coordinates: { lng: 139.7652, lat: 35.6718 } },
    ],
    lunch: { place: "Vegan Ramen UZU Tokyo", nameJa: "UZU Tokyo (teamLab Planets)", nameHe: "אוזו טוקיו — ראמן טבעוני (בתוך טים-לאב פלנטס)", desc: "Team Lab + ראמן צמחוני/טבעוני מעולה — חוויה אמנותית. ציון: 10/10", rating: "10/10", coordinates: { lng: 139.7902768, lat: 35.6491723 } },
    dinner: { place: "Chidori Roppongi", nameJa: "千鳥 六本木店", nameHe: "צ'ידורי רופונגי (יאקיטורי)", desc: "נחמד, לא זול", rating: "7.5/10", coordinates: { lng: 139.7309748, lat: 35.6640658 } },
    tips: ["teamLab — כרטיס הכי מוקדם!", "גאנדם — לא הפסל שזז"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "TeamLab — 189 ₪" }, images: [],
  },
  {
    day: 23, title: "יום 23 - קוואגוצ'י", city: "Kawaguchiko", cityHe: "קוואגוצ'י",
    coordinates: { lng: 138.7529, lat: 35.5117 },
    attractions: [
      { name: "Toyota Rent a Car Odawara", nameJa: "トヨタレンタカー 小田原", nameHe: "טויוטה רנט א קאר", desc: "אספנו רכב — עדיף לא לנהוג בטוקיו ולקחת את הרכב מהפרברים", coordinates: { lng: 139.1522, lat: 35.2564 } },
      { name: "Lake Kawaguchiko", nameJa: "河口湖", nameHe: "אגם קוואגוצ'י", desc: "10/10", coordinates: { lng: 138.7529, lat: 35.5117 } },
    ],
    lunch: { place: "Mizunokaze", nameJa: "みずの風", nameHe: "מיזונו קאזה — מסעדה ליד האגם", desc: "חמודה", rating: "7/10", coordinates: { lng: 138.7447435, lat: 35.5237474 } },
    dinner: { place: "Italian near hotel", nameJa: "イタリアンレストラン", nameHe: "מסעדה איטלקית ליד המלון", desc: "נחמד, טעים, לא זול", rating: "7.5/10", coordinates: { lng: 138.7560, lat: 35.5130 } },
    tips: ["רכב מ-Odawara — אחלה פתרון", "לקוות ליום בהיר לפוג'י"],
    hotel: "Fuji View Hotel", expenses: { accommodation: "981 ₪", highlights: "Toyota — 1,100 ₪" }, images: [],
  },
  {
    day: 24, title: "יום 24 - האקונה", city: "Hakone", cityHe: "האקונה",
    coordinates: { lng: 139.0261, lat: 35.2326 },
    attractions: [
      // Morning around Lake Kawaguchi before driving to Hakone — tagged
      // Kawaguchiko so the city filter shows them under the right bucket.
      { name: "Hakone Viewpoints", nameJa: "箱根展望台", nameHe: "נקודות תצפית האקונה", desc: "זריחה מעוננת, הסתובבנו באזור", coordinates: { lng: 139.0200, lat: 35.2350 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "The Park (Pancakes)", nameJa: "ザ・パーク パンケーキ", nameHe: "דה פארק — פנקייקים", desc: "פנקייקים עננים ליד האגם עם תור ארוך מאוד — הכרנו את נור ואור. ציון: 8/10", coordinates: { lng: 139.0300, lat: 35.2310 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "Hotel Onsen", nameJa: "温泉", nameHe: "אונסן במלון", desc: "חובה!", coordinates: { lng: 139.0261, lat: 35.2326 } },
    ],
    lunch: { place: "The Park Pancakes", nameJa: "ザ・パーク パンケーキ", nameHe: "פנקייקים — דה פארק", desc: "פנקייקים עננים ליד האגם עם תור ארוך מאוד. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.0300, lat: 35.2310 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
    dinner: { place: "Hotel Buffet", nameJa: "ホテルビュッフェ", nameHe: "בופה במלון", desc: "נחמד, אונסן אחרי", rating: "7/10", coordinates: { lng: 139.0261, lat: 35.2326 } },
    tips: ["זריחה — ההר לא תמיד נראה", "אונסן — חובה!", "פנקייקים — תור ארוך, שווה"],
    hotel: "Hotel Green Plaza Hakone", expenses: { accommodation: "1,795 ₪ (2 לילות)", highlights: "אונסן, פנקייקים" }, images: [],
  },
  {
    day: 25, title: "יום 25 - פוג'י", city: "Hakone", cityHe: "האקונה / פוג'י",
    coordinates: { lng: 138.7667, lat: 35.4891 },
    attractions: [
      // Morning + most of the day around Mt. Fuji / Lake Kawaguchi.
      // The outlet and the evening onsen are the only Hakone-side stops.
      { name: "Mt. Fuji Clear View!", nameJa: "富士山 絶景!", nameHe: "הר פוג'י — ראות מושלמת!", desc: "קם 05:30 — מושלם!", coordinates: { lng: 138.7529, lat: 35.5117 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "Fuji Street & Lake", nameJa: "富士街道・湖", nameHe: "רחוב פוג'י ואגם", desc: "טיול בוקר ליד האגם ורחוב עם נוף לפוג'י", coordinates: { lng: 138.7550, lat: 35.5090 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "Chureito Pagoda", nameJa: "新倉山浅間公園 忠霊塔", nameHe: "פגודת צ'ורייטו", desc: "צילומים מטורפים — הנוף האייקוני של פוג'י", coordinates: { lng: 138.8047, lat: 35.4891 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "Starbucks Kawaguchiko", nameJa: "スターバックス 河口湖", nameHe: "סטארבקס קוואגוצ'י", desc: "סטארבקס עם נוף לפוג'י", coordinates: { lng: 138.7535, lat: 35.5125 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
      { name: "Gotemba Premium Outlets", nameJa: "御殿場プレミアム・アウトレット", nameHe: "גוטמבה אאוטלט", desc: "שווה ממש!", coordinates: { lng: 138.9348, lat: 35.2895 } },
      { name: "Onsen & Sunset", nameJa: "温泉と夕日", nameHe: "אונסן ושקיעה", desc: "קריסה מושלמת", coordinates: { lng: 139.0261, lat: 35.2326 } },
    ],
    lunch: { place: "Kawaguchiko Area", nameJa: "河口湖エリア", nameHe: "אזור קוואגוצ'י", desc: "אכלנו תוך כדי", rating: "—", coordinates: { lng: 138.7529, lat: 35.5117 }, city: "Kawaguchiko", cityHe: "קוואגוצ'יקו" },
    dinner: { place: "—", nameJa: "", nameHe: "", desc: "אונסן — קריסה", rating: "—", coordinates: null },
    tips: ["לקום ב-05:30 ליום בהיר!", "פגודה + אגם = צילומים מטורפים", "Gotemba Outlets — שווה"],
    hotel: "Hotel Green Plaza Hakone", expenses: { accommodation: "כלול", highlights: "אאוטלט, אונסן" }, images: [],
  },
  {
    day: 26, title: "יום 26 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7292, lat: 35.6604 },
    attractions: [
      { name: "Hakone Open Air Museum", nameJa: "箱根彫刻の森美術館", nameHe: "מוזיאון הפתוח האקונה", desc: "נחמד, שווה בדרך", coordinates: { lng: 139.0477, lat: 35.2472 } },
      { name: "Tokyo Metropolitan Gov. Building", nameJa: "東京都庁展望台", nameHe: "תצפית מבניין העירייה", desc: "תצפית חינמית!", coordinates: { lng: 139.6917, lat: 35.6896 } },
      { name: "GIGO Shinjuku", nameJa: "GiGO 新宿", nameHe: "גיגו שינג'וקו", desc: "מכונות פרסים — לקחנו מיו", coordinates: { lng: 139.7010, lat: 35.6928 } },
    ],
    lunch: { place: "Iruca Tokyo Roppongi", nameJa: "イルカ東京 六本木", nameHe: "אירוקה טוקיו רופונגי", desc: "מהראמניות הטובות ביותר שאכלנו בטיול, ראמן שמבוסס 8 טארה שונים. ציון: 9.5/10", rating: "9.5/10", coordinates: { lng: 139.7316413, lat: 35.6648012 } },
    dinner: { place: "Conveyor Sushi Shinjuku", nameJa: "回転寿司 新宿", nameHe: "סושי מסוע שינג'וקו", desc: "סושי מסוע בשינג'וקו לסגירת יום. ציון: 7.5/10", rating: "7.5/10", coordinates: { lng: 139.7005, lat: 35.6896 } },
    tips: ["מוזיאון הפתוח — נחמד בדרך", "Iruca — אחת הראמניות הטובות בטיול!", "בניין העירייה — תצפית חינמית!"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "4,100 ₪ (5 לילות)", highlights: "Iruca Ramen, סושי מסוע" }, images: [],
  },
  {
    day: 27, title: "יום 27 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7313, lat: 35.6638 },
    attractions: [
      { name: "BRICOLAGE Bread & Co.", nameJa: "ブリコラージュ ブレッド", nameHe: "בריקולאז' — מאפייה", desc: "מאפייה צרפתית-יפנית ברופונגי. פגז!", coordinates: { lng: 139.7286, lat: 35.6610 } },
      { name: "MUJI Shinjuku", nameJa: "無印良品 新宿", nameHe: "מוג'י שינג'וקו", desc: "קניות", coordinates: { lng: 139.6998, lat: 35.6912 } },
      { name: "Isetan Shinjuku", nameJa: "伊勢丹 新宿", nameHe: "איסטן שינג'וקו", desc: "כלבו דגל יפני אייקוני — אופנה ודפאצ׳יקה (מרתף אוכל) פגז", coordinates: { lng: 139.7036, lat: 35.6917 } },
      { name: "V2 Tokyo Roppongi", nameJa: "V2 TOKYO 六本木", nameHe: "V2 טוקיו רופונגי", desc: "מסיבה — משוגע!", coordinates: { lng: 139.7320, lat: 35.6630 } },
    ],
    lunch: { place: "Shin Udon", nameJa: "慎うどん", nameHe: "שין אודון", desc: "אודון מפורסם בשינג'וקו. ציון: 7/10 (בגלל המתנה של 4 שעות)", rating: "7/10", coordinates: { lng: 139.7015, lat: 35.6900 } },
    dinner: { place: "McDonald's + V2 Club", nameJa: "マクドナルド → V2 TOKYO", nameHe: "מקדונלדס ואז V2", desc: "המבורגר שרימפס מיוחד ליפן ואז מסיבה ב-V2! ציון: 6/10 (מקדונלדס)", rating: "—", coordinates: { lng: 139.7320, lat: 35.6630 } },
    tips: ["BRICOLAGE — מושלם ברופונגי", "שין אודון — over-rated, 4 שעות", "V2 — מסיבה מטורפת!"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "BRICOLAGE, שין אודון" }, images: [],
  },
  {
    day: 28, title: "יום 28 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7185, lat: 35.7295 },
    attractions: [
      { name: "Sunshine City Ikebukuro", nameJa: "サンシャインシティ 池袋", nameHe: "סאנשיין סיטי איקבוקורו", desc: "קניון + אקווריום", coordinates: { lng: 139.7185, lat: 35.7295 } },
      { name: "Sunshine Aquarium", nameJa: "サンシャイン水族館", nameHe: "אקווריום סאנשיין", desc: "אקווריום על גג סאנשיין סיטי — פינגווינים מרחפים מעל הראש", coordinates: { lng: 139.7194, lat: 35.7295 } },
      { name: "Kappabashi Street", nameJa: "合羽橋道具街", nameHe: "רחוב קפאבאשי (כלי מטבח)", desc: "מעולה! עם נור ואור", coordinates: { lng: 139.7897, lat: 35.7120 } },
    ],
    lunch: { place: "Kuwabara", nameJa: "桑原", nameHe: "קוואברה (ראמן + הודי)", desc: "יואב ראמן, מיכלי הודי", rating: "7/10", coordinates: { lng: 139.7164466, lat: 35.7291612 } },
    dinner: { place: "Kura Sushi Asakusa", nameJa: "くら寿司 浅草", nameHe: "קורה סושי אסאקוסה", desc: "סושי מסוע באסאקוסה — זוועה. ציון: 3/10", rating: "3/10", coordinates: { lng: 139.7966, lat: 35.7148 } },
    tips: ["Sunshine City — אקווריום נחמד", "קפאבאשי — כלי מטבח, שווה!", "סושי באסאקוסה — לא!"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "Sunshine City, קפאבאשי" }, images: [],
  },
  {
    day: 29, title: "יום 29 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7671, lat: 35.6284 },
    attractions: [
      { name: "Starbucks Reserve Nakameguro", nameJa: "スターバックスリザーブ 中目黒", nameHe: "סטארבקס רזרב נאקה-מגורו", desc: "סניף הדגל בנאקה-מגורו על התעלה", coordinates: { lng: 139.6989, lat: 35.6441 } },
      { name: "Uniqlo & Don Quijote", nameJa: "ユニクロ＆ドンキ", nameHe: "יוניקלו ודונקי", desc: "קניות וממתקים", coordinates: { lng: 139.6989, lat: 35.6598 } },
    ],
    lunch: { place: "Ramen HAYASHI", nameJa: "ラーメン はやし", nameHe: "ראמן האיאשי", desc: "ראמן בשיבויה, ציר חזיר שרימפס ועוף וקליפת תפוז. אמאלה! ציון: 9/10", rating: "9/10", coordinates: { lng: 139.7310, lat: 35.6605 } },
    dinner: { place: "ARIA Roppongi", nameJa: "ARIA 六本木", nameHe: "אריה רופונגי", desc: "מסעדה איטלקית ברופונגי. ציון: 7.5/10", rating: "7.5/10", coordinates: { lng: 139.7295, lat: 35.6615 } },
    tips: ["ראמן HAYASHI — מעולה!", "סטארבקס נאקה-מגורו — מיוחד"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "HAYASHI, סטארבקס" }, images: [],
  },
  {
    day: 30, title: "יום 30 - טוקיו", city: "Tokyo", cityHe: "טוקיו",
    coordinates: { lng: 139.7308, lat: 35.6601 },
    attractions: [
      { name: "BRICOLAGE Bread & Co.", nameJa: "ブリコラージュ ブレッド", nameHe: "בריקולאז' — קפה", desc: "מאפייה צרפתית-יפנית ברופונגי. פגז! חזרנו פעם שנייה", coordinates: { lng: 139.7286, lat: 35.6610 } },
      { name: "Nakameguro", nameJa: "中目黒", nameHe: "נאקה-מגורו", desc: "סיבוב נוסף", coordinates: { lng: 139.6989, lat: 35.6441 } },
      { name: "Golden Gai", nameJa: "ゴールデン街", nameHe: "גולדן גאי", desc: "פעם שנייה — תמיד כיף!", coordinates: { lng: 139.7042, lat: 35.6938 } },
    ],
    lunch: { place: "Japanese Yakiniku Nikugen", nameJa: "肉源 六本木", nameHe: "יקיניקו ניקוגן רופונגי", desc: "בשר צלוי על גריל אישי ברופונגי. ציון: 8/10", rating: "8/10", coordinates: { lng: 139.7296021, lat: 35.6622982 } },
    dinner: { place: "Uogashi Nihon-Ichi Shibuya Dogenzaka", nameJa: "魚がし日本一 渋谷道玄坂店", nameHe: "אוגאשי ניהון-איצ'י שיבויה דוגנזאקה", desc: "סושי בעמידה בשיבויה, חוויה אינטימית מול השף", rating: "8.5/10", coordinates: { lng: 139.6998, lat: 35.6600 } },
    tips: ["סושי עמידה — חוויה אמיתית", "Golden Gai — תמיד כיף"],
    hotel: "Act Hotel Roppongi", expenses: { accommodation: "כלול", highlights: "יקיניקו, סושי עמידה" }, images: [],
  },
  {
    day: 31, title: "יום 31 - הביתה ✈️", city: "Tokyo", cityHe: "טוקיו → הביתה",
    coordinates: { lng: 139.7454, lat: 35.6585 },
    attractions: [
      { name: "Shinjuku Gyoen", nameJa: "新宿御苑", nameHe: "שינג'וקו גויין", desc: "גן מושלם לסיום!", coordinates: { lng: 139.7100, lat: 35.6852 } },
      { name: "Harajuku (Last Visit)", nameJa: "原宿（最後）", nameHe: "הראג'וקו (אחרון)", desc: "סיבוב אחרון", coordinates: { lng: 139.7074, lat: 35.6693 } },
    ],
    lunch: { place: "AFURI (Last Ramen!)", nameJa: "阿夫利（最後!）", nameHe: "אפורי (ראמן אחרון!)", desc: "ראמן עוף מבוסס יוזו — ראמן אחרון ביפן! ציון: 9/10", rating: "9/10", coordinates: { lng: 139.7054, lat: 35.6691 } },
    dinner: { place: "—", nameJa: "", nameHe: "", desc: "טיסה", rating: "—", coordinates: null },
    tips: ["שינג'וקו גויין — מושלם לסיום", "AFURI — ראמן אחרון"],
    hotel: "—", expenses: { accommodation: "—", highlights: "AFURI אחרון" }, images: [],
  },
];

/* ── Canonical hotel coordinates.
      Hotels in tripData don't carry their own lng/lat, so the day-centre
      is used as a fallback. Entries here override that fallback with the
      real lodging pin (source: user-verified Google Maps URL).           */
const HOTEL_COORDINATES = {
  // Tokyo (Roppongi) — user-verified Google Maps URL
  "Act Hotel Roppongi":               { lng: 139.7294462, lat: 35.6624377 },
  // Tokyo Disney area (Maihama)
  "HOTEL MYSTAYS Maihama":            { lng: 139.8780,    lat: 35.6477 },
  // Kanazawa (near Kanazawa Station east side)
  "Hotel Kanazawa Zoushi":            { lng: 136.6504,    lat: 36.5774 },
  // Takayama (near Takayama Station)
  "Residence Hotel Takayama Station": { lng: 137.2530,    lat: 36.1430 },
  // Matsumoto (near station)
  "Tabino Hotel lit Matsumoto":       { lng: 137.9693,    lat: 36.2336 },
  // Nagoya (near station / Meieki area)
  "Daiwa Roynet Hotel Nagoya":        { lng: 136.8841,    lat: 35.1709 },
  // Osaka (Shinsaibashi/Namba area)
  "Granbell Hotel Osaka":             { lng: 135.5022,    lat: 34.6716 },
  // Kyoto (Shijo Muromachi)
  "Hotel Resol Kyoto Shijo Muromachi":{ lng: 135.7591,    lat: 35.0044 },
  // Kawaguchiko (Lake Kawaguchi north shore)
  "Fuji View Hotel":                  { lng: 138.7647,    lat: 35.5163 },
  // Hakone (mountain area)
  "Hotel Green Plaza Hakone":         { lng: 139.0095,    lat: 35.2548 },
};

const routePath = [
  { city: "Tokyo", coordinates: [139.6917, 35.6895] },
  { city: "Kanazawa", coordinates: [136.6256, 36.5613] },
  { city: "Takayama", coordinates: [137.2531, 36.1461] },
  { city: "Matsumoto", coordinates: [137.9721, 36.2381] },
  { city: "Nagoya", coordinates: [136.9066, 35.1815] },
  { city: "Osaka", coordinates: [135.5023, 34.6937] },
  { city: "Nara", coordinates: [135.8048, 34.6851] },
  { city: "Kyoto", coordinates: [135.7681, 35.0116] },
  { city: "Tokyo 2", coordinates: [139.7312, 35.6622] },
  { city: "Kawaguchiko", coordinates: [138.7529, 35.5117] },
  { city: "Hakone", coordinates: [139.0261, 35.2326] },
  { city: "Tokyo 3", coordinates: [139.7292, 35.6604] },
];

export { tripData, routePath, HOTEL_COORDINATES };
