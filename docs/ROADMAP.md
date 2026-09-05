# Roadmap — Maslul (מסלול)

Ideas and requested features not yet scheduled into a spec/plan. Not a
commitment or a sprint order — just a running list so nothing gets lost.
When one of these gets picked up, it should go through the normal flow
(`superpowers:brainstorming` → spec → plan) and can be removed from here
or marked done.

| # | Feature | Notes |
|---|---|---|
| 1 | **בניית טיול אוטומטית מכל הנקודות השמורות** — "תבנה לי טיול עם כל הנקודות השמורות שלי" | לפתח עוד. הרעיון: לקחת את "כל הנקודות שלי" (הבנק הגלובלי, חוצה-טיולים — `EditorView.jsx`, Sprint 47 #4) ולהזין אותו כקלט לצינור יצירת הטיולים ב-AI (`api/generate-trip.js` / `aiTrip.js`), במקום להתחיל מדף חלק. שאלות פתוחות לפני שממשיכים: איך בוחרים אילו נקודות שמורות רלוונטיות (לפי יעד? הכל?), האם ה-AI רק מסדר/מקבץ אותן לימים או גם ממלא פערים בין נקודות, ומה קורה כשיש מעט מדי / הרבה מדי נקודות שמורות ליעד. שייך לתחום `ai-engineer`. |
| 2 | **התראות למייל / וואטסאפ** | פיצ'ר תשתית — ערוץ התראות כללי לטיול (לא רק לסעיף 3). דורש בחירת ספק (מייל: כבר יש דרך Supabase; וואטסאפ: אינטגרציה חדשה — WhatsApp Business API / Twilio וכו', כנראה דרך `vercel:marketplace`). לתכנן טוב לפני מימוש — נושק ל-#3. |
| 3 | **"עד מתי אפשר לבטל" על נקודה + התראה** | שדה חדש על עצירה בציר הזמן (תאריך/שעה "ביטול חינם עד") — רלוונטי בעיקר להזמנות מלון/סיור/מסעדה. כשמתקרב מועד הביטול — התראה למייל/וואטסאפ (תלוי בסעיף 2). דורש: שדה נתונים חדש על attraction, UI להזנה/עריכה, לוגיקת תזמון להתראה (cron / scheduled job). |

---

*Added 2026-09-05, from a direct request. If you already track ideas
somewhere else (Notion, a note, etc.), let me know and I'll fold this
list in there instead and stop maintaining a separate file here.*
