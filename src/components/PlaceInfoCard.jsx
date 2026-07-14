import React, { useState } from "react";
import { CATEGORY_META, classifyLocation, ratingToBadge } from "../utils/classify";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   PlaceInfoCard — floating overlay shown after a Google Places
   prediction is selected in the editor.

   Displays:
     • Photo header (180 px) from photos[0].getUrl() or category
       emoji on a gradient fallback.
     • Category badge + close ×
     • Name (h2), address, star rating row
     • Horizontal day-select pill row
     • "הוספה לטיול שלי" CTA

   Props:
     place     — raw getDetails() result enriched with photoUrl /
                 ratingCount (see googlePlaces.js)
     days      — array of { dayNum, cityName } for the pill row
     activeDay — currently selected day index (0-based)
     onAdd(stop, dayIndex) — commit to that day
     onClose()
   ══════════════════════════════════════════════════════════════ */

const FONT   = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";

/* Build a filled / half / empty star row from a 0-5 rating. */
const StarRow = ({ rating }) => {
  if (rating == null) return null;
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.3 && rating - full < 0.8 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {Array(full).fill(0).map((_, i) => <span key={`f${i}`} style={{ color: "#F5A623", fontSize: 14 }}>★</span>)}
      {half === 1 && <span style={{ color: "#F5A623", fontSize: 14, opacity: 0.55 }}>★</span>}
      {Array(empty).fill(0).map((_, i) => <span key={`e${i}`} style={{ color: "#D1CCC5", fontSize: 14 }}>★</span>)}
    </span>
  );
};

/* Category → gradient colours for photo fallback */
const CAT_GRADIENT = {
  food:       ["#E0533F", "#B83A2B"],
  cafe:       ["#C9A03F", "#9C7826"],
  hotel:      ["#4A7FB5", "#345C86"],
  attraction: ["#4E9E94", "#2B7B71"],
  unknown:    ["#8A94A0", "#5E6772"],
};

const PlaceInfoCard = ({ place, days = [], activeDay = 0, onAdd, onSaveToInbox, onClose }) => {
  const [selDay, setSelDay] = useState(activeDay);

  if (!place) return null;

  const { category } = classifyLocation(place.types || []);
  const cat     = category === "unknown" ? "attraction" : category;
  const meta    = CATEGORY_META[cat];
  const grad    = CAT_GRADIENT[cat] || CAT_GRADIENT.unknown;
  const badge   = ratingToBadge(place.rating);

  const toStop = () => ({
    name: place.name,
    nameHe: place.name,
    category: meta.he,
    rating: badge || undefined,
    /* Sprint 28 #2 — carry the official Google address so the timeline
       can render the muted metadata block under the user's notes. */
    address: place.address || undefined,
    /* Sprint 31 — persist the Google photo + editorial snippet already
       fetched with the details call (no new API request), so the map
       bottom sheet shows the real image and the timeline shows the
       description. */
    photoUrl: place.photoUrl || undefined,
    description: place.description || undefined,
    coordinates: (place.lat != null && place.lng != null)
      ? { lat: place.lat, lng: place.lng }
      : undefined,
  });

  const commit = () => {
    if (!onAdd) return;
    onAdd(toStop(), selDay);
  };

  return (
    <div
      dir="rtl"
      className="tp-sheet-up"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 55,
        maxWidth: 720, margin: "0 auto",
        background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: "0 -20px 60px rgba(0,0,0,0.22)",
        fontFamily: FONT, overflow: "hidden",
      }}
    >
      {/* ── Photo / fallback header ─────────────────────────── */}
      <div style={{
        position: "relative", height: 180, flexShrink: 0,
        background: place.photoUrl
          ? `center/cover url(${place.photoUrl}), linear-gradient(145deg, ${grad[0]}, ${grad[1]})`
          : `linear-gradient(145deg, ${grad[0]}, ${grad[1]})`,
      }}>
        {!place.photoUrl && (
          <span aria-hidden style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 62, opacity: 0.65,
            filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.3))",
          }}>{meta.emoji}</span>
        )}
        {/* Gradient scrim so text is legible over the photo */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 50%)",
        }} />

        {/* Category badge — top-right */}
        <span style={{
          position: "absolute", top: 12, insetInlineEnd: 12,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
          color: "#fff", fontSize: 11.5, fontWeight: 700, borderRadius: 999,
          padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <span aria-hidden>{meta.emoji}</span>{meta.he}
        </span>

        {/* Close button — top-left */}
        <button
          onClick={onClose}
          aria-label="סגירה"
          style={{
            position: "absolute", top: 12, insetInlineStart: 12,
            width: 34, height: 34, borderRadius: "50%", border: "none",
            background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)",
            color: "#fff", cursor: "pointer", display: "inline-flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="x" size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 0" }}>
        {/* Name */}
        <h2 style={{
          margin: "0 0 4px", fontSize: 20, fontWeight: 800,
          color: "#0D0F11", lineHeight: 1.2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{place.name}</h2>

        {/* Address */}
        {place.address && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 5,
            fontSize: 12.5, color: "#6B7178", marginBottom: 10, lineHeight: 1.4,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name="pin" size={13} strokeWidth={1.8} /></span>
            <span>{place.address}</span>
          </div>
        )}

        {/* Star rating row */}
        {place.rating != null && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 16,
          }}>
            <StarRow rating={place.rating} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: "#0D0F11" }}>
              {place.rating.toFixed(1)}
            </span>
            {place.ratingCount != null && (
              <span style={{ fontSize: 12, color: "#8B9198" }}>
                ({place.ratingCount.toLocaleString("he-IL")} ביקורות)
              </span>
            )}
            {badge && (
              <span style={{
                marginInlineStart: "auto",
                background: "#E4EFE5", color: "#2B7B71",
                fontSize: 11, fontWeight: 800, borderRadius: 999,
                padding: "3px 9px",
              }}>{badge}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Day selector ────────────────────────────────────── */}
      {days.length > 0 && (
        <div style={{ padding: "0 18px 16px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8B9198", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            שייך ליום ספציפי:
          </div>
          <div style={{
            display: "flex", gap: 7, overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
            {days.map((d, i) => {
              const on = selDay === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelDay(i)}
                  style={{
                    flexShrink: 0, height: 38, borderRadius: 999, border: "none",
                    padding: "0 14px", cursor: "pointer", fontFamily: FONT,
                    fontSize: 13, fontWeight: 700, transition: "all 0.15s ease",
                    background: on ? "#0D0F11" : "#F6F6F4",
                    color: on ? "#fff" : "#2A3036",
                    boxShadow: on ? "0 2px 8px rgba(0,0,0,0.18)" : "none",
                  }}
                >
                  יום {d.dayNum}
                  {d.cityName && (
                    <span style={{ fontSize: 10.5, opacity: 0.7, marginInlineStart: 4 }}>
                      {d.cityName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────── */}
      <div style={{ padding: "0 18px 28px" }}>
        <button
          onClick={commit}
          className="tp-press"
          style={{
            width: "100%", height: 54, borderRadius: 999, border: "none",
            background: ACCENT, color: "#fff",
            fontSize: 16, fontWeight: 800, cursor: "pointer",
            fontFamily: FONT,
            boxShadow: `0 4px 18px ${ACCENT}55`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Icon name="pin" size={17} strokeWidth={2.2} />
          הוספה לטיול שלי
        </button>

        {/* Sprint 27 #5 — Option A: route to the generic Places Inbox
            ("בנק נקודות") instead of a specific day. */}
        {onSaveToInbox && (
          <button
            onClick={() => onSaveToInbox(toStop())}
            style={{
              width: "100%", height: 44, marginTop: 10, borderRadius: 999,
              border: "1.5px dashed rgba(20,20,20,0.18)", background: "#F6F6F4",
              color: "#2A3036", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            🗂️ שמור בבנק הנקודות הכללי
          </button>
        )}
      </div>
    </div>
  );
};

export default PlaceInfoCard;
