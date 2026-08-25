import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { addFavorite, removeFavorite } from "../services/favoritesService";
import { useAuth } from "../context/AuthContext";
import { track } from "../analytics/posthog";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   FavoriteButton — login-gated star toggle.

   Self-contained pill/circle button: filled accent when favorited,
   neutral outline otherwise. Optimistic toggle (parent state flips
   immediately via onChange, reverted on a failed write). Signed-out
   taps redirect to /auth instead of touching favorites at all — the
   caller's `favorited` prop never changes in that case.
   ══════════════════════════════════════════════════════════════ */

const ink3 = "#6B7178";
const accent = "#E0533F";
const line = "rgba(20,20,20,0.09)";

const FavoriteButton = ({ tripId, favorited, onChange, returnTo, size = 18 }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate("/auth", { state: { from: returnTo || (location.pathname + location.search) } });
      return;
    }

    if (busy) return;
    setBusy(true);

    const next = !favorited;
    onChange(next);
    try {
      if (next) await addFavorite(tripId);
      else await removeFavorite(tripId);
      track(next ? "map_favorited" : "map_unfavorited", { trip_id: tripId });
    } catch {
      onChange(!next); // revert optimistic update
    } finally {
      setBusy(false);
    }
  };

  const dim = size + 14;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label="מועדף"
      title={favorited ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        border: favorited ? `1px solid ${accent}` : `1px solid ${line}`,
        background: favorited ? "rgba(224,83,63,0.1)" : "#FFFFFF",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.7 : 1,
        padding: 0,
        transition: "background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
        flexShrink: 0,
      }}
    >
      <Icon
        name="star"
        size={size}
        color={favorited ? accent : ink3}
        style={favorited ? { fill: accent } : undefined}
      />
    </button>
  );
};

export default FavoriteButton;
