import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* ══════════════════════════════════════════════════════════════
   HOME PAGE — Modern Japanese Minimalism
   ──────────────────────────────────────────────────────────────
   RTL Hebrew landing page that introduces the trip and routes
   visitors into the interactive map (/map). Five sections:
     1. Hero            — couple photo + headline + CTA
     2. Timeline        — 5 trip chapters with day ranges
     3. Photo Gallery   — 7 highlight images
     4. Stats           — 31 days · 6 cities · 3 parks · 1 car
     5. Footer
   Design language: Noto Serif/Sans Hebrew, off-white base,
   single crimson accent, generous whitespace.
   ══════════════════════════════════════════════════════════════ */

/* ─── IntersectionObserver hook for one-shot fade-up animations ─── */
function useVisible(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ─── DATA ─── */
const chapters = [
  {
    num: "01",
    city: "טוקיו (חלק ראשון)",
    cityEn: "Tokyo I",
    days: "ימים 1–7",
    desc: "הימים הראשונים בעיר, האזורים המרכזיים ופארקי דיסני.",
    bg: "rgba(192,57,43,0.08)",
    accent: "#C0392B",
    /* Deep-link target on the /map route */
    cityKey: "Tokyo#1",
  },
  {
    num: "02",
    city: "קנזוואה והאלפים היפניים",
    cityEn: "Kanazawa & Alps",
    days: "ימים 8–13",
    desc: "נסיעה לצפון-מערב, שוק הדגים, גני קנזוואה, שירקאווה-גו וסקי.",
    bg: "rgba(61,74,92,0.06)",
    accent: "#3D4A5C",
    cityKey: "Kanazawa",
  },
  {
    num: "03",
    city: "אוסקה, נארה ונגויה",
    cityEn: "Osaka, Nara & Nagoya",
    days: "ימים 14–19",
    desc: "המעבר לאוסקה, יוניברסל סטודיוס, נארה וסיורי אוכל.",
    bg: "rgba(192,57,43,0.06)",
    accent: "#C0392B",
    cityKey: "Osaka",
  },
  {
    num: "04",
    city: "קיוטו",
    cityEn: "Kyoto",
    days: "ימים 20–24",
    desc: "חמישה ימים המוקדשים למקדשים, יער הבמבוק, שווקים מקומיים וחיי לילה.",
    bg: "rgba(61,74,92,0.06)",
    accent: "#3D4A5C",
    cityKey: "Kyoto",
  },
  {
    num: "05",
    city: "האקונה, פוג׳י וחזרה לטוקיו",
    cityEn: "Hakone, Fuji & Tokyo II",
    days: "ימים 25–31",
    desc: "השכרת רכב באזור חמשת האגמים, תצפיות פוג׳י וסיום בטוקיו.",
    bg: "rgba(192,57,43,0.06)",
    accent: "#C0392B",
    cityKey: "Hakone",
  },
];

const galleryItems = [
  { label: "ראמן Afuri, טוקיו",   labelEn: "Afuri Ramen · Tokyo",   img: "/photos/source/day01_afuri.jpg",         day: "יום 1"  },
  { label: "ארמון אוסקה",          labelEn: "Osaka Castle",           img: "/photos/source/day10_osaka-castle.jpg",  day: "יום 10" },
  { label: "פושימי אינארי, קיוטו", labelEn: "Fushimi Inari · Kyoto",  img: "/photos/source/day15_fushimi-inari.jpg", day: "יום 15" },
  { label: "TeamLab, אוסקה",       labelEn: "teamLab · Osaka",        img: "/photos/source/day18_uzu-teamlab.jpg",   day: "יום 18" },
  { label: "אקיהברה, טוקיו",       labelEn: "Akihabara · Tokyo",      img: "/photos/source/day21_akihabara.jpg",     day: "יום 21" },
  { label: "צ׳ורייטו — הר פוג׳י",  labelEn: "Chureito · Mt. Fuji",    img: "/photos/source/day25_chureito.jpg",      day: "יום 25" },
  { label: "ראמן בטוקיו",          labelEn: "Ramen · Tokyo",          img: "/photos/source/day26_lunch_hiruka.jpg",  day: "יום 26" },
];

const stats = [
  { value: "31", label: "ימים",     icon: "📅" },
  { value: "9",  label: "ערים",     icon: "🏙" },
  { value: "3",  label: "פארקים",   icon: "🎡" },
  { value: "1",  label: "רכב שכור", icon: "🚗" },
];

/* ─── ARROW (rotated for RTL — points left toward reading direction) ─── */
const CtaArrow = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" style={{ transform: "rotate(180deg)", flexShrink: 0 }}>
    <path d="M4 9H14M14 9L9.5 4.5M14 9L9.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   1. HERO
   ══════════════════════════════════════════════════════════════ */
const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col lg:flex-row items-center overflow-hidden px-6 md:px-16 lg:px-0">
      {/* Decorative kanji (very subtle) */}
      <span className="jp-deco" style={{ top: "8%", left: "2%", fontSize: "10rem" }}>日</span>
      <span className="jp-deco" style={{ bottom: "10%", left: "4%", fontSize: "6rem" }}>本</span>

      {/* Top thin rule */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-l from-crimson via-slate-pale to-transparent opacity-60" />

      {/* Nav hint top-right */}
      <div className="absolute top-8 right-6 md:right-16 lg:right-24 anim-fade-in delay-5">
        <div className="flex items-center gap-3">
          <div className="w-6 h-px bg-slate-mid opacity-40" />
          <span className="text-slate-light uppercase font-sans" style={{ fontSize: "10px", letterSpacing: "0.2em" }}>
            Japan 2024
          </span>
        </div>
      </div>

      {/* Hero photo (left, 42% — desktop only) */}
      <div
        className="hidden lg:block flex-shrink-0 anim-fade-in delay-4"
        style={{ width: "42%", height: "100vh", position: "relative" }}
      >
        <div className="relative h-full w-full overflow-hidden">
          <img
            src="/photos/home/hero_couple_fuji.png"
            alt="Couple in front of Mt. Fuji"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ filter: "brightness(0.92) saturate(0.95)" }}
          />
          {/* Fade toward text (to the right in LTR === toward inner edge) */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to left, #F7F5F0 0%, rgba(247,245,240,0.1) 35%, transparent 100%)" }}
          />
          <div className="absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(to bottom, #F7F5F0, transparent)" }} />
          <div className="absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(to top, #F7F5F0, transparent)" }} />
        </div>
      </div>

      {/* Text content (right) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-2 lg:px-16 py-24 lg:py-0">
        {/* Eyebrow */}
        <div className="anim-fade-up flex items-center gap-3 mb-8">
          <div className="w-8 h-px bg-crimson" />
          <span className="text-crimson uppercase font-sans" style={{ fontSize: "11px", letterSpacing: "0.22em" }}>
            מרץ–אפריל 2024
          </span>
        </div>

        {/* Headline */}
        <h1
          className="anim-fade-up delay-1 font-serif text-slate-deep mb-6"
          style={{ fontSize: "clamp(2.2rem, 5vw, 4.2rem)", fontWeight: 300, lineHeight: 1.18, letterSpacing: "-0.01em" }}
        >
          המסלול וההמלצות<br />
          <span style={{ fontWeight: 600 }}>מהטיול שלנו ליפן</span>
        </h1>

        {/* Subheadline */}
        <p
          className="anim-fade-up delay-2 text-slate-mid font-sans mb-12"
          style={{ fontSize: "clamp(0.95rem, 1.5vw, 1.1rem)", fontWeight: 300, lineHeight: 1.85, maxWidth: "520px" }}
        >
          קיבלנו המון בקשות לשתף את המסלול שלנו, והחלטנו לבנות את המערכת הזאת כדי לרכז את כל הטיול
          וההמלצות שלנו במקום אחד. האתר מחולק לפי ימים, ערים וקטגוריות, כדי שיהיה לכם קל לנווט.
        </p>

        {/* CTA */}
        <div className="anim-fade-up delay-3">
          <Link
            to="/map"
            className="btn-premium inline-flex items-center gap-4 bg-slate-deep text-offwhite px-10 py-5 font-sans text-base font-medium"
            style={{ letterSpacing: "0.04em" }}
          >
            <span>כניסה למפה האינטראקטיבית</span>
            <CtaArrow />
          </Link>
        </div>
      </div>

      {/* Scroll hint bottom-right */}
      <div className="absolute bottom-10 right-6 md:right-16 anim-fade-in delay-5 flex flex-col items-center gap-2">
        <div className="w-px h-12 bg-gradient-to-b from-slate-pale to-transparent" />
        <span className="text-slate-light" style={{ fontSize: "10px", letterSpacing: "0.2em", writingMode: "vertical-rl" }}>
          גלול למטה
        </span>
      </div>

      {/* Crimson accent strip (right edge) */}
      <div className="absolute bottom-0 right-0 w-px h-2/3 bg-gradient-to-b from-transparent via-crimson to-transparent opacity-20" />
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════
   2. TIMELINE
   ══════════════════════════════════════════════════════════════ */
const ChapterCard = ({ chapter, index, isLast }) => {
  const [ref, visible] = useVisible(0.1);
  return (
    <Link
      ref={ref}
      to={`/map?city=${encodeURIComponent(chapter.cityKey)}`}
      className="chapter-card relative flex gap-0 cursor-pointer no-underline"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
        transition: `opacity 0.7s ease ${index * 0.1}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${index * 0.1}s`,
      }}
    >
      {/* Timeline node */}
      <div className="flex flex-col items-center" style={{ minWidth: "40px" }}>
        <div
          className="dot-pulse rounded-full border-2 mt-1 flex-shrink-0"
          style={{
            width: "14px",
            height: "14px",
            borderColor: chapter.accent,
            background: index === 0 ? chapter.accent : "transparent",
          }}
        />
        {!isLast && (
          <div className="flex-1 w-px mt-2" style={{ background: "rgba(28,35,51,0.12)", minHeight: "60px" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 mr-5 mb-6 p-6 rounded-sm" style={{ background: chapter.bg }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span
                className="font-serif text-4xl leading-none"
                style={{ color: "rgba(28,35,51,0.12)", fontWeight: 300 }}
              >
                {chapter.num}
              </span>
              <div>
                <div
                  className="font-sans"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    color: chapter.accent,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    marginBottom: "2px",
                  }}
                >
                  {chapter.cityEn}
                </div>
                <h3
                  className="font-serif text-slate-deep"
                  style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", fontWeight: 600, lineHeight: 1.3 }}
                >
                  {chapter.city}
                </h3>
              </div>
            </div>
            <p className="text-slate-mid font-sans text-sm mt-2" style={{ fontWeight: 300, lineHeight: 1.6 }}>
              {chapter.desc}
            </p>
          </div>
          <span
            className="font-sans px-3 py-1 rounded-full flex-shrink-0"
            style={{
              background: "rgba(28,35,51,0.07)",
              color: "#3D4A5C",
              letterSpacing: "0.05em",
              fontSize: "11px",
            }}
          >
            {chapter.days}
          </span>
        </div>
      </div>
    </Link>
  );
};

const Timeline = () => {
  const [ref, visible] = useVisible(0.1);
  return (
    <section className="px-6 md:px-16 lg:px-24 py-24 relative">
      <div className="max-w-3xl mx-auto md:mx-0">
        {/* Section header */}
        <div
          ref={ref}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(20px)",
            transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-crimson" />
            <span className="text-crimson uppercase font-sans" style={{ fontSize: "11px", letterSpacing: "0.22em" }}>
              The Journey
            </span>
          </div>
          <h2
            className="font-serif text-slate-deep mb-12"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.8rem)", fontWeight: 300, lineHeight: 1.25 }}
          >
            פרקי<br />
            <span style={{ fontWeight: 600 }}>המסלול</span>
          </h2>
        </div>

        {/* Chapters */}
        {chapters.map((ch, i) => (
          <ChapterCard key={ch.num} chapter={ch} index={i} isLast={i === chapters.length - 1} />
        ))}
      </div>

      {/* Right-edge decorative rule */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-slate-pale to-transparent opacity-60" />
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════
   3. GALLERY
   ══════════════════════════════════════════════════════════════ */
const GalleryCard = ({ item, index, tall }) => {
  const [ref, visible] = useVisible(0.08);
  return (
    <div
      ref={ref}
      className="gallery-card group cursor-pointer overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "scale(0.96)",
        transition: `opacity 0.65s ease ${index * 0.07}s, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${index * 0.07}s`,
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ paddingBottom: tall ? "118%" : "80%" }}>
        <img
          src={item.img}
          alt={item.label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
        {/* Day badge */}
        <div
          className="absolute top-3 right-3 font-sans text-white px-2 py-0.5"
          style={{
            background: "rgba(28,35,51,0.55)",
            backdropFilter: "blur(6px)",
            fontSize: "10px",
            letterSpacing: "0.1em",
          }}
        >
          {item.day}
        </div>
        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-end p-4 opacity-0 group-hover:opacity-100"
          style={{
            background: "linear-gradient(to top, rgba(28,35,51,0.75) 0%, transparent 55%)",
            transition: "opacity 0.35s ease",
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: "9px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              {item.labelEn}
            </div>
            <div className="font-serif text-white" style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.3 }}>
              {item.label}
            </div>
          </div>
        </div>
      </div>
      {/* Card label */}
      <div className="px-3 py-2.5" style={{ background: "#F7F5F0" }}>
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "0.18em",
            color: "#8A95A3",
            textTransform: "uppercase",
            marginBottom: "2px",
          }}
        >
          {item.labelEn}
        </div>
        <div className="font-serif text-slate-deep" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
          {item.label}
        </div>
      </div>
    </div>
  );
};

const Gallery = () => {
  const [ref, visible] = useVisible(0.1);
  return (
    <section className="px-6 md:px-16 lg:px-24 py-24 bg-parchment">
      <div
        ref={ref}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-px bg-crimson" />
          <span className="text-crimson uppercase font-sans" style={{ fontSize: "11px", letterSpacing: "0.22em" }}>
            Gallery
          </span>
        </div>
        <h2
          className="font-serif text-slate-deep mb-12"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.8rem)", fontWeight: 300, lineHeight: 1.25 }}
        >
          תמונות<br />
          <span style={{ fontWeight: 600 }}>מהדרך</span>
        </h2>
      </div>

      {/* Desktop: Row 1 (3 tall) + Row 2 (4 short) */}
      <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {galleryItems.slice(0, 3).map((item, i) => (
          <GalleryCard key={item.label} item={item} index={i} tall={true} />
        ))}
      </div>
      <div className="hidden md:grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {galleryItems.slice(3).map((item, i) => (
          <GalleryCard key={item.label} item={item} index={i + 3} tall={false} />
        ))}
      </div>
      {/* Mobile: 2 columns */}
      <div className="grid md:hidden grid-cols-2 gap-4">
        {galleryItems.map((item, i) => (
          <GalleryCard key={item.label} item={item} index={i} tall={false} />
        ))}
      </div>
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════
   4. STATS
   ══════════════════════════════════════════════════════════════ */
const Stats = () => {
  const [ref, visible] = useVisible(0.15);
  return (
    <section className="px-6 md:px-16 lg:px-24 py-20 bg-slate-deep relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 60px)",
        }}
      />

      <div ref={ref} className="relative z-10 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="stat-item text-center"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : "translateY(16px)",
                transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 0.1}s`,
              }}
            >
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div
                className="font-serif text-offwhite mb-1"
                style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 600, lineHeight: 1 }}
              >
                {stat.value}
              </div>
              <div
                className="font-sans text-slate-pale"
                style={{ fontSize: "0.85rem", letterSpacing: "0.05em", fontWeight: 300 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 pt-12 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p
            className="font-serif text-slate-pale font-light"
            style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.8 }}
          >
            טיול בלתי נשכח שהתחיל בחלום ולאסוף זיכרונות לכל החיים.
          </p>
          <div className="mt-8">
            <Link
              to="/map"
              className="btn-premium inline-flex items-center gap-4 border text-offwhite px-10 py-4 font-sans text-sm font-medium"
              style={{ borderColor: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}
            >
              <span>כניסה למפה האינטראקטיבית</span>
              <CtaArrow size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════
   5. FOOTER
   ══════════════════════════════════════════════════════════════ */
const Footer = () => (
  <footer
    className="px-6 md:px-16 lg:px-24 py-8 flex items-center justify-between flex-wrap gap-4"
    style={{ borderTop: "1px solid rgba(28,35,51,0.1)" }}
  >
    <div className="flex items-center gap-3">
      <div className="w-1 h-6 bg-crimson opacity-70" />
      <span className="font-serif text-slate-mid text-sm" style={{ fontWeight: 300 }}>
        יפן 2024
      </span>
    </div>
    <div className="font-sans text-slate-light" style={{ fontSize: "11px", letterSpacing: "0.15em" }}>
      מרץ – אפריל 2024
    </div>
  </footer>
);

/* ══════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════ */
const HomePage = () => {
  /* Force RTL on the document while the home page is mounted, then
     restore on unmount so the /map route keeps its existing
     direction logic untouched. */
  useEffect(() => {
    const prevDir = document.documentElement.getAttribute("dir");
    const prevLang = document.documentElement.getAttribute("lang");
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "he");
    return () => {
      if (prevDir) document.documentElement.setAttribute("dir", prevDir);
      else document.documentElement.removeAttribute("dir");
      if (prevLang) document.documentElement.setAttribute("lang", prevLang);
      else document.documentElement.removeAttribute("lang");
    };
  }, []);

  return (
    <div
      className="min-h-screen home-noise"
      style={{ backgroundColor: "#F7F5F0", color: "#1C2333", fontFamily: "'Noto Sans Hebrew', sans-serif" }}
    >
      <Hero />
      <Timeline />
      <Gallery />
      <Stats />
      <Footer />
    </div>
  );
};

export default HomePage;
