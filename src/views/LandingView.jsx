import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useActiveTrip from "../utils/useActiveTrip";
import tripService from "../services/tripService";
import SiteFooter from "../components/SiteFooter";
import BrandMark from "../components/BrandMark";
import RouteSeam from "../components/RouteSeam";
import DestinationSearch from "../components/DestinationSearch";
import { startTrip } from "../utils/startTripLink";
import { tripData } from "../data/tripData";
import { STOP_PHOTO } from "../data/stopPhotos";
import { getPhotoUrl } from "../data/photoMap";
import "./LandingView.css";

/* ══════════════════════════════════════════════════════════════
   LandingView — the public homepage.

   Built to docs/superpowers/specs/2026-09-06-homepage-redesign-design.md.
   ONE responsive component: LandingDesktop.jsx is deleted, along with
   its drifting duplicate constants.

   Fold rhythm (§1.3): photograph → warm black → paper → vermillion
   drench → paper-2 → warm black. The drench lands on the proof fold
   on purpose — the one fold that stops selling and shows receipts is
   the one that is unmistakably branded.

   Single action, repeated once: pick a destination. The hero field
   and the closing field are the same component, and both route
   through `startTripLink.js` — the one resolver, per DESIGN.md's
   single-resolver rule.

   Theme: committed light. Owner decision (D4). The marketing palette
   is defined once in LandingView.css as custom properties; there are
   no inline hex values and no per-view `T` object.
   ══════════════════════════════════════════════════════════════ */

/* Popular destinations. Each maps to a wizard country id so the
   choice carries into /create. */
const CHIPS = [
  { label: "יפן", dest: "jp" },
  { label: "איטליה", dest: "it" },
  { label: "תאילנד", dest: "th" },
  { label: "פורטוגל", dest: "pt" },
  { label: "יוון", dest: "gr" },
  { label: "וייטנאם", dest: "vn" },
];

/* Real, countable properties of an artifact that is live on this site
   and one click away. NOT usage statistics, and never to be phrased as
   any. Verified in-repo 2026-09-07: 31 `day:` entries, 155 attractions,
   16 cityHe values deduping to 10 real cities, 177 files directly in
   /public/photos/source/. */
const STATS = [
  { n: "31", label: "ימים" },
  { n: "10", label: "ערים" },
  { n: "155", label: "עצירות" },
  { n: "177", label: "תמונות" },
];

const OBJECTIONS = [
  { c: "גיליון לא יודע איפה הדברים נמצאים.", a: "כל עצירה יושבת על מפה אמיתית, עם הקואורדינטות שלה." },
  { c: "גיליון לא יגיד לכם שזה 40 דקות ברכבת.", a: "זמני הליכה ותחבורה בין עצירות מחושבים אוטומטית." },
  { c: "גיליון לא נפתח יפה כשאתם עומדים בצומת.", a: "עצירה, תמונה, הערה, וכפתור אחד ל־Google Maps." },
  { c: "אבל אפשר לשתף אותו כמו גיליון.", a: "הזמנה במייל, הרשאת צפייה או עריכה, בדיוק כמו Google Docs." },
];

const ArrowStart = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

/* ── Fold 1: the live demo, from the same bundled data /map?demo=1 uses ── */
const DemoFold = () => {
  const [day, setDay] = useState(1);
  const dayData = useMemo(() => tripData.find((d) => d.day === day) || tripData[0], [day]);

  /* Project the day's real coordinates into the SVG viewBox. */
  const pins = useMemo(() => {
    const pts = (dayData.attractions || [])
      .filter((a) => a.coordinates && Number.isFinite(a.coordinates.lat))
      .slice(0, 6);
    if (!pts.length) return [];
    const lngs = pts.map((p) => p.coordinates.lng);
    const lats = pts.map((p) => p.coordinates.lat);
    const minX = Math.min(...lngs), maxX = Math.max(...lngs);
    const minY = Math.min(...lats), maxY = Math.max(...lats);
    const spanX = maxX - minX || 0.001, spanY = maxY - minY || 0.001;
    return pts.map((p, i) => ({
      i,
      name: p.nameHe || p.name,
      /* RTL-agnostic: this is geography, not layout. 12% padding. */
      x: 12 + ((p.coordinates.lng - minX) / spanX) * 76,
      y: 88 - ((p.coordinates.lat - minY) / spanY) * 76,
    }));
  }, [dayData]);

  const cards = useMemo(() => (dayData.attractions || []).slice(0, 3).map((a) => ({
    name: a.nameHe || a.name,
    category: a.category || "",
    rating: a.rating || "",
    photo: getPhotoUrl(STOP_PHOTO[`${dayData.day}|${a.name}`]),
  })), [dayData]);

  const line = pins.length > 1
    ? "M " + pins.map((p) => `${p.x} ${p.y}`).join(" L ")
    : "";

  return (
    <div className="demo">
      <div className="demo-rail" role="tablist" aria-label="ימי המסלול">
        {tripData.map((d) => (
          <button
            key={d.day}
            role="tab"
            aria-selected={d.day === day}
            className={`demo-chip ${d.day === day ? "is-on" : ""}`}
            onClick={() => setDay(d.day)}
          >
            יום {d.day} · {d.cityHe}
          </button>
        ))}
      </div>

      <div className="demo-body">
        <div className="demo-map" role="img" aria-label={`מפת יום ${day} ב${dayData.cityHe}, ${pins.length} עצירות`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="100" className="demo-map-bg" />
            <g className="demo-grid">
              <line x1="0" y1="25" x2="100" y2="25" /><line x1="0" y1="50" x2="100" y2="50" />
              <line x1="0" y1="75" x2="100" y2="75" /><line x1="25" y1="0" x2="25" y2="100" />
              <line x1="50" y1="0" x2="50" y2="100" /><line x1="75" y1="0" x2="75" y2="100" />
            </g>
            {line && <path d={line} className="demo-route" vectorEffect="non-scaling-stroke" />}
          </svg>
          {pins.map((p) => (
            /* NOTE: `left`, deliberately, and it is the one place on this
               surface where a physical property is correct. These coordinates
               are a GEOGRAPHIC projection shared with the SVG route path, whose
               x axis is always measured from the left. Using insetInlineStart
               here mirrors the pins against their own route line under dir=rtl
               — east and west do not swap because the page is Hebrew. */
            <span key={p.i} className="demo-pin" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              {p.i + 1}
            </span>
          ))}
        </div>

        <div className="demo-cards">
          {cards.map((c) => (
            <div className="demo-card" key={c.name}>
              {c.photo
                ? <img src={c.photo} alt="" loading="lazy" decoding="async" width="64" height="64" />
                : <span className="demo-card-ph" aria-hidden="true" />}
              <span className="demo-card-txt">
                <b>{c.name}</b>
                <span>{c.category}</span>
              </span>
              {c.rating && <span className="demo-rate">{c.rating}</span>}
            </div>
          ))}
          <a className="demo-out" href={`/map?demo=1&day=${day}`}>
            לפתוח את המסלול המלא <ArrowStart size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

const LandingView = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const activeId = useActiveTrip();
  const [activeTrip, setActiveTrip] = useState(null);
  const demoRef = useRef(null);

  /* Active-trip behaviour is PRESERVED, position changed: it becomes a
     slim banner above the nav and must not shape the hero. It is dormant
     on `/` but live on the path="*" catch-all. */
  useEffect(() => {
    let live = true;
    if (!activeId) { setActiveTrip(null); return undefined; }
    tripService.fetchTripById(activeId)
      .then((t) => { if (live) setActiveTrip(t); })
      .catch(() => { if (live) setActiveTrip(null); });
    return () => { live = false; };
  }, [activeId]);

  const go = (choice) => startTrip(choice, { isAuthenticated, navigate });
  const activeRoute = activeTrip?.readOnly ? "/map?demo=1" : `/map/edit/${activeId}`;

  return (
    <div className="lp" dir="rtl">
      {activeId && (
        <div className="lp-resume">
          <div className="lp-wrap">
            <span className="lp-resume-txt">
              הטיול הפעיל שלכם{activeTrip?.title ? ` · ${activeTrip.title}` : ""}
            </span>
            <button className="lp-resume-btn" onClick={() => navigate(activeRoute)}>
              חזרה למפה <ArrowStart size={13} />
            </button>
          </div>
        </div>
      )}

      <nav className="lp-nav">
        <div className="lp-wrap">
          <span className="lp-brand">
            <span className="lp-brand-mark" aria-hidden="true"><BrandMark size={15} /></span>
            מסלול
          </span>
          <button className="lp-login" onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}>
            {isAuthenticated ? "המפות שלי" : "התחברות"}
          </button>
        </div>
      </nav>

      {/* ── Fold 0 — Hook. The question. ───────────────────────── */}
      <header className="f0">
        <div className="f0-photo">
          {/* srcset + sizes ONLY — no <source media> siblings. Combining the
              two made the browser fetch more than one derivative for a single
              paint, which is exactly the wrong thing to do to an LCP element.
              <picture> is retained as the wrapper so adding AVIF/WebP later is
              one <source> line (see scripts/build-landing-assets.mjs). */}
          <picture>
            <img
              src="/photos/home/derived/hero-720.jpg"
              srcSet="/photos/home/derived/hero-480.jpg 480w, /photos/home/derived/hero-720.jpg 720w, /photos/home/derived/hero-1026.jpg 1026w"
              sizes="(min-width: 1024px) 46vw, 100vw"
              alt="יואב ומיכלי מול הר פוג'י, במסלול שממנו נולד מסלול."
              width="1026" height="1848"
              fetchpriority="high" decoding="async"
            />
          </picture>
          <h1 className="f0-h1-over">כל הטיול שלכם.<br />על מפה אחת.</h1>
        </div>

        <div className="f0-panel">
          <h1 className="f0-h1-side">כל הטיול שלכם.<br />על מפה אחת.</h1>
          <div className="f0-field">
            <DestinationSearch onPick={go} />
            <div className="f0-chips" role="group" aria-label="יעדים פופולריים">
              {CHIPS.map((c) => (
                <button key={c.dest} onClick={() => go(c)}>{c.label}</button>
              ))}
            </div>
          </div>
          <p className="f0-lede">
            בונים מסלול יום אחר יום, מוסיפים מקומות אמיתיים מהמפה, ויוצאים לדרך עם משהו
            שאפשר לפתוח באמצע הרחוב.
          </p>
          <p className="f0-micro">בחינם, בלי כרטיס אשראי.</p>
        </div>
      </header>

      <RouteSeam variant={0} />

      {/* ── Fold 1 — What this is actually for. ─────────────────
          Added because the question people kept asking was not "is it
          good" but "what is it FOR". The arc is one sentence: plan it,
          keep everything about it in one place, then actually use it on
          the trip. Three stages, numbered — and the numbering is
          load-bearing, because this IS a sequence in time. The old
          "in the field" fold is absorbed here as stage 3 rather than
          repeating the same argument twice on one page. */}
      <section className="fw">
        <div className="lp-wrap">
          <h2>מה בעצם עושים עם מסלול?</h2>
          <p className="fw-lede">
            בונים את הטיול פעם אחת, שומרים עליו במקום אחד, ואז פותחים אותו בשטח —
            במקום לחפש הכל מחדש בין צילומי מסך, מיילים והודעות בוואטסאפ.
          </p>

          <ol className="fw-stages">
            <li className="fw-stage">
              <div className="fw-txt">
                <span className="fw-num" aria-hidden="true">1</span>
                <h3>מתכננים יום אחר יום</h3>
                <p>
                  מחפשים מקום, והוא נכנס ליום שלו בציר הזמן ומופיע מיד על המפה.
                  גוררים כדי לשנות סדר, והמערכת מחשבת מחדש את זמני המעבר בין העצירות.
                </p>
              </div>
              <div className="fw-vis">
                <div className="ui">
                  <div className="ui-bar"><i /><i /><i /><span>יום 1 · טוקיו</span></div>
                  <div className="ui-row">
                    <span className="ui-n">1</span>
                    <span className="ui-t"><b>האראג׳וקו ואומוטסנדו</b><em>רחוב</em></span>
                    <span className="ui-h">09:20</span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-n">2</span>
                    <span className="ui-t"><b>AFURI האראג׳וקו</b><em>ראמן · 14 דק׳ הליכה</em></span>
                    <span className="ui-h">12:00</span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-n">3</span>
                    <span className="ui-t"><b>מקדש מייג׳י</b><em>מקדש · 11 דק׳ הליכה</em></span>
                    <span className="ui-h">16:10</span>
                  </div>
                </div>
              </div>
            </li>

            <li className="fw-stage">
              <div className="fw-txt">
                <span className="fw-num" aria-hidden="true">2</span>
                <h3>הכל על הטיול, במקום אחד</h3>
                <p>
                  כרטיסי הטיסה, אישור המלון וה־JR Pass נשמרים על הטיול עצמו ועל
                  העצירה שאליה הם שייכים — לא בתיקיית הורדות. לצידם יושב התקציב:
                  כמה תכננתם לכל קטגוריה, כמה באמת שילמתם, ומה נשאר.
                </p>
              </div>
              <div className="fw-vis fw-vis-pair">
                <div className="ui">
                  <div className="ui-bar ui-bar-t"><span>קבצי הטיול</span><b className="ui-badge">7</b></div>
                  <div className="ui-row">
                    <span className="ui-file">PDF</span>
                    <span className="ui-t"><b>כרטיסי טיסה</b><em>כללי</em></span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-file">PDF</span>
                    <span className="ui-t"><b>אישור מלון קיוטו</b><em>יום 18</em></span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-file ui-file-img">IMG</span>
                    <span className="ui-t"><b>JR Pass</b><em>כללי</em></span>
                  </div>
                </div>
                <div className="ui">
                  <div className="ui-bar ui-bar-t"><span>ניצול התקציב</span><b className="ui-mini">62%</b></div>
                  <div className="ui-meter"><span style={{ inlineSize: "62%" }} /></div>
                  <div className="ui-row">
                    <span className="ui-t"><b>טיסות</b><em>מתוכנן ₪6,400</em></span>
                    <span className="ui-amt is-full">בפועל ₪6,400</span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-t"><b>לינה</b><em>מתוכנן ₪4,200</em></span>
                    <span className="ui-amt">בפועל ₪3,850</span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-t"><b>אוכל</b><em>מתוכנן ₪2,100</em></span>
                    <span className="ui-amt">בפועל ₪1,240</span>
                  </div>
                </div>
              </div>
            </li>

            <li className="fw-stage">
              <div className="fw-txt">
                <span className="fw-num" aria-hidden="true">3</span>
                <h3>ואז יוצאים לדרך</h3>
                <p>
                  התכנון נגמר בבית, המסלול ממשיך איתכם. בשטח פותחים את היום הנוכחי,
                  מסמנים מה כבר ביקרתם, ופותחים ניווט לעצירה הבאה בלחיצה אחת.
                  אותו מסלול בדיוק, בלי לחפש מחדש.
                </p>
                <ul className="fw-claims">
                  <li>כפתור אחד פותח את המקום ב־Google Maps.</li>
                  <li>זמני הליכה ותחבורה בין עצירות, מחושבים אוטומטית.</li>
                  <li>הערות, תמונות וקבצים יושבים על העצירה עצמה.</li>
                </ul>
              </div>
              <div className="fw-vis">
                <div className="ui">
                  <div className="ui-bar ui-bar-live"><span className="ui-dot" aria-hidden="true" />טיול פעיל · יום 18, קיוטו</div>
                  <div className="ui-row is-done">
                    <span className="ui-check" aria-hidden="true">✓</span>
                    <span className="ui-t"><b>פושימי אינארי טאישה</b><em>ביקרנו · 07:40</em></span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-ring" aria-hidden="true" />
                    <span className="ui-t"><b>שוק נישיקי</b><em>אוכל · 22 דק׳ ברכבת</em></span>
                    <span className="ui-nav">ניווט</span>
                  </div>
                  <div className="ui-row">
                    <span className="ui-ring" aria-hidden="true" />
                    <span className="ui-t"><b>קיומיזו־דרה</b><em>מקדש · 9 דק׳ הליכה</em></span>
                    <span className="ui-nav">ניווט</span>
                  </div>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <RouteSeam variant={1} />


      {/* ── Fold 1 — Show the thing working. ───────────────────── */}
      <section className="f1" ref={demoRef}>
        <div className="lp-wrap">
          <h2>זה לא מוקאפ. זה מסלול אמיתי.</h2>
          <p className="f1-lede">
            31 ימים ביפן, 155 עצירות, כל אחת עם המלצה שנכתבה בשטח. בחרו יום ותראו מה קורה על המפה.
          </p>
          <DemoFold />
        </div>
      </section>

      <RouteSeam variant={2} />


      {/* ── Fold 3 — Proof. The vermillion drench. ─────────────── */}
      <section className="f3">
        <div className="lp-wrap">
          <div className="f3-top">
            <div>
              <p className="f3-origin">
                חזרנו מיפן עם 155 עצירות בגיליון אקסל, וכל מי שביקש את המסלול לא הצליח
                לקרוא אותו. אז בנינו את מסלול.
              </p>
              <p className="f3-sig">יואב ומיכלי</p>
              <a className="f3-link" href="/japan">לראות את המסלול המקורי <ArrowStart size={14} /></a>
            </div>
            <div className="f3-stats">
              {STATS.map((s) => (
                <span className="f3-stat" key={s.label}>
                  <b>{s.n}</b><span>{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RouteSeam variant={3} />

      {/* ── Fold 4 — Answer the objection. ─────────────────────── */}
      <section className="f4">
        <div className="lp-wrap">
          <h2>למה לא פשוט גיליון?</h2>
          <div className="f4-rows">
            {OBJECTIONS.map((o, i) => (
              <div className={`f4-row f4-r${i + 1} ${i === 3 ? "is-turn" : ""}`} key={o.c}>
                <span className="f4-c">{o.c}</span>
                <span className="f4-a">{o.a}</span>
              </div>
            ))}
          </div>
          <p className="f4-close">החשבון חינם. אין כרטיס אשראי.</p>
        </div>
      </section>

      <RouteSeam variant={4} terminal onDark />

      {/* ── Fold 5 — Ask. ─────────────────────────────────────── */}
      <section className="f5">
        <div className="lp-wrap">
          <h2>אז לאן נוסעים?</h2>
          <div className="f5-field">
            <DestinationSearch onPick={go} tone="dark" />
            <div className="f0-chips f5-chips" role="group" aria-label="יעדים פופולריים">
              {CHIPS.slice(0, 4).map((c) => (
                <button key={c.dest} onClick={() => go(c)}>{c.label}</button>
              ))}
            </div>
          </div>
          <p className="f5-micro">שלוש שאלות ויש לכם שלד מסלול.</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default LandingView;
