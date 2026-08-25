/* ══════════════════════════════════════════════════════════════
   releaseNotes — Sprint 44 product-updates feed.

   A simple ordered list of shipped sprints. The ProductUpdatesModal
   compares the highest `sprint` here against the user's locally-stored
   `last_viewed_sprint` and shows what they missed. Add a new entry at
   the TOP whenever a sprint ships — `LATEST_SPRINT` updates itself.
   ══════════════════════════════════════════════════════════════ */

export const RELEASE_NOTES = [
  {
    sprint: 44,
    emoji: "🚀",
    title: "עדכוני מוצר, תפריט פעולה צף וכרטיס תחנה חכם",
    bullets: [
      "🆕 חלון עדכוני מוצר — כל מה שחדש, במקום אחד",
      "🎯 תפריט פעולות צף (FAB) — סיכום, מסלול רציף ותכנון בלחיצה",
      "📍 כרטיס תחנה מתמשך בסגנון Google Maps",
      "↗️ ניווט ישיר ל-Google Maps מכל תחנה",
      "📝 תיבת הערה אישית מעוצבת ששומרת על שורות",
    ],
  },
  {
    sprint: 43,
    emoji: "🗓️",
    title: "תאריכי לוח גמישים לטיול",
    bullets: [
      "📅 בחירת תאריכים קלנדריים או מספר ימים באשף",
      "🗓️ הגדרה ושינוי תאריכים מכל שלב בעריכה",
      "🔢 תאריך עברי מלא על גבי הימים והכותרות",
      "📊 התאריכים זורמים לסיכום ולייצוא ה-CSV",
    ],
  },
  {
    sprint: 42,
    emoji: "🗺️",
    title: "מפת מסלול רציף וחיפוש מהיר",
    bullets: [
      "🔢 תצוגת מפה של כל המסלול עם מספור גלובלי",
      "🔎 חיפוש מהיר וזורם ללא חסימות",
      "🏨 הוספת מלון לכמה ימים בבת אחת",
      "➕ הוספת נקודה מבנק הנקודות ישירות ליום",
    ],
  },
  {
    sprint: 41,
    emoji: "✋",
    title: "גרירה חלקה וסידור ימים",
    bullets: [
      "🖐️ גרירה חלקה של ערים באשף (גם במגע)",
      "⇅ מצב עריכה לסידור מחדש של הימים",
      "📅 קפיצה מהירה ליום עם חשיפת המפה",
    ],
  },
];

/* The newest sprint number available in the app. */
export const LATEST_SPRINT = RELEASE_NOTES.reduce((m, r) => Math.max(m, r.sprint), 0);

export default RELEASE_NOTES;
