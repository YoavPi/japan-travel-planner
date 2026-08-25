import React from "react";
import { Link } from "react-router-dom";
import FavoriteButton from "./FavoriteButton";
import { coverIsEmoji, coverEmoji } from "../utils/gallery";

/* ══════════════════════════════════════════════════════════════
   GalleryCard — one public-trip tile for /gallery.

   The whole card surface is a <Link> to /g/:id (single anchor, not
   a click-handler wrapper) so the nested FavoriteButton's own
   stopPropagation is enough to keep starring from also navigating.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.09)", accent: "#E0533F", surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const GalleryCard = ({ trip, favorited, onToggleFav }) => {
  const cover = trip?.cover;
  const isEmoji = coverIsEmoji(cover);
  const isUrl = !isEmoji && typeof cover === "string" && cover.length > 0;

  return (
    <div
      className="tp-press"
      style={{
        borderRadius: 20,
        border: `1px solid ${T.line}`,
        overflow: "hidden",
        background: T.bg,
        fontFamily: T.font,
        position: "relative",
      }}
    >
      <Link
        to={`/g/${trip.id}`}
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        {/* Cover */}
        <div
          style={{
            height: 180,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isUrl ? `center/cover url(${cover})` : T.surface,
          }}
        >
          {isEmoji ? (
            <span style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>{coverEmoji(cover)}</span>
          ) : !isUrl ? (
            <span
              aria-hidden
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(145deg, #EFEFEC, #E4E3DE)",
              }}
            />
          ) : null}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 16px 14px" }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {trip.title}
          </div>
          <div style={{ fontSize: 13.5, color: T.ink3, marginTop: 4 }}>
            {trip.days} ימים · {trip.settings?.destinationHe || ""}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <span style={{ fontSize: 13, color: T.ink4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              מאת {trip.owner?.name}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: T.ink3, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span aria-hidden>⭐</span> {trip.favoritesCount || 0}
              </span>
              <FavoriteButton
                tripId={trip.id}
                favorited={favorited}
                onChange={(n) => onToggleFav(trip.id, n)}
                returnTo="/gallery"
                size={16}
              />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default GalleryCard;
