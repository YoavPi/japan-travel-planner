import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapComponent from "../components/MapComponent";
import DetailModal from "../components/DetailModal";
import BottomSheet from "../components/BottomSheet";
import StoryFlow from "../components/StoryFlow";
import OmniboxSearch from "../components/OmniboxSearch";
import { MetaIcon } from "../components/StoryFlowGlyph";

/* ══════════════════════════════════════════════════════════════
   EXPLORE VIEW — Travel-Story v3
   ──────────────────────────────────────────────────────────────
   Desktop (lg+):
     [ Map (flex:1) ][ Right Story Panel (560px, collapsible) ]
   Mobile (<lg):
     [ Full-screen Map ]
     [ BottomSheet over the map containing the StoryFlow ]
   ══════════════════════════════════════════════════════════════ */
const ExploreView = () => {
  const [searchParams] = useSearchParams();

  /* selectedDay drives the map flyTo on day selection. The active
     stop drives the map's pinned-popup and the StoryFlow scroll. */
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [activeStopId, setActiveStopId] = useState(null);

  /* Hierarchical filters (Phase A city → Phase B category):
       activeCity     — chronological key like "Tokyo#1" / "Kanazawa".
                        Controls StoryFlow AND drives the map's
                        city-filter logic.
       activeFilter   — category sub-filter inside the active city.
                        One of: 'attractions' | 'food' | 'shopping' |
                        'hotels' | null. Forced null whenever the
                        user changes day or city ("clean state"
                        rule, see handleSelectDay / handleCityChange). */
  const [activeFilter, setActiveFilter] = useState(null);
  const [activeCity, setActiveCity] = useState(null);

  const [modalData, setModalData] = useState(null);
  const [macroSignal, setMacroSignal] = useState(0);

  /* Story panel collapsed state (desktop) */
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  /* Refs */
  const sheetRef    = useRef(null);
  const storyDeskRef = useRef(null);
  const storyMobRef  = useRef(null);

  /* ── Deep-link query params on mount ── */
  useEffect(() => {
    const cityParam = searchParams.get("city");
    const dayParam = searchParams.get("day");
    if (cityParam) setActiveCity(cityParam);
    if (dayParam) {
      const n = parseInt(dayParam, 10);
      if (!Number.isNaN(n)) setSelectedDay(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Map → flow sync: scroll the visible flow to the selected day ── */
  useEffect(() => {
    if (selectedDay == null) return;
    setTimeout(() => {
      storyDeskRef.current?.scrollToDay?.(selectedDay);
      storyMobRef.current?.scrollToDay?.(selectedDay);
    }, 60);
    if (sheetRef.current?.getSnap?.() === "peek") {
      sheetRef.current.snapTo("half");
    }
  }, [selectedDay]);

  /* ── Handlers ── */
  /* Picking a new day is a "Full Reset": both the city pill AND
     the category sub-filter snap back to the default 'all'
     state. This guarantees the chosen day is always renderable —
     filters can never hide the day a user just asked for. */
  const handleSelectDay = useCallback((day) => {
    setSelectedDay((prev) => prev === day ? prev : day);
    setSelectedLocation(null);
    setActiveStopId(null);
    setActiveFilter(null);
    setActiveCity(null);
  }, []);

  const handleSelectStop = useCallback((payload) => {
    if (!payload) return;
    setActiveStopId(payload.stopId);
    /* Synchronised navigation (per latest design directive):
       The map ALWAYS flies to the selected location, regardless of
       whether the click came from a map pin or a StoryFlow card.
       The detail modal opens in front of the map — the user can see
       the map re-centre behind it. The bottom sheet / sidebar are
       NOT collapsed; their state is preserved so the user keeps
       their browsing context. The `skipMapFly` flag is intentionally
       ignored here. */
    if (payload.coordinates) {
      setSelectedLocation({
        lng: payload.coordinates.lng,
        lat: payload.coordinates.lat,
        name: payload.name,
      });
    }
  }, []);

  /* The map popup "עוד פרטים" button is now a navigation cue, not
     a modal trigger. It snaps the bottom sheet open (mobile) and
     scrolls the StoryFlow list to the matching stop on both
     surfaces. Stop matching is done by name + day inside the
     buildStory output — we look up the stopId via a name index. */
  const handleOpenDetail = useCallback((data) => {
    if (!data) return;
    const targetName = (data.name || "").trim().toLowerCase();
    const dayHint   = data.day || null;
    /* Snap the bottom sheet open (mobile). 'full' gives the user
       maximum context for reading the expanded card. */
    sheetRef.current?.snapTo?.("full");
    /* Walk both story refs and ask them to scroll to the matching
       stop. The refs expose scrollToStop(stopId); we resolve the
       stopId here from the buildStory result. */
    import("../data/storyBuilder").then(({ buildStory }) => {
      const story = buildStory();
      const match = story.find((it) =>
        it.type === "stop" &&
        (!dayHint || it.day === dayHint) &&
        ((it.titleEn || "").trim().toLowerCase() === targetName ||
         (it.titleHe || "").trim().toLowerCase() === targetName)
      );
      if (match) {
        setActiveStopId(match.stopId);
        /* Defer to next tick so the sheet snap settles, then ask
           the mobile StoryFlow to OPEN the inline expansion on
           that stop (so the user lands on a fully-expanded card,
           not just a scrolled-to one). Desktop has no expansion,
           so it only scrolls. */
        setTimeout(() => {
          storyMobRef.current?.expandStop?.(match.stopId);
          storyDeskRef.current?.scrollToStop?.(match.stopId);
        }, 80);
      }
    });
    /* Always re-centre the map on the location too. */
    if (data.coordinates) {
      setSelectedLocation({
        lng: data.coordinates.lng,
        lat: data.coordinates.lat,
        name: data.name,
      });
    }
  }, []);
  const handleCloseDetail = useCallback(() => setModalData(null), []);

  const handleMacroView = useCallback(() => {
    setSelectedDay(null);
    setSelectedLocation(null);
    setActiveStopId(null);
    setActiveCity(null);
    setMacroSignal((s) => s + 1);
    sheetRef.current?.snapTo?.("peek");
  }, []);

  /* Phase B: toggle the category sub-filter. Picking the same
     category again clears it. */
  const handleFilterChange = useCallback((next) => {
    setActiveFilter((prev) => (prev === next ? null : next));
  }, []);

  /* Phase A: tap a city pill to toggle. Whenever the city changes
     (including toggling it off), we wipe the category sub-filter
     and any active stop/location so the user never lands on an
     empty intersection. */
  const handleCityChange = useCallback((cityKey) => {
    setActiveCity((prev) => (prev === cityKey ? null : cityKey));
    setActiveFilter(null);
    setSelectedLocation(null);
    setActiveStopId(null);
  }, []);

  /* Clear all filters (the "כל הטיול" pill). */
  const handleClearFilters = useCallback(() => {
    setActiveCity(null);
    setActiveFilter(null);
    setSelectedLocation(null);
    setActiveStopId(null);
  }, []);

  /* Omnibox search → location selection.
     Sync trio (matches the "עוד פרטים" handler):
       1. Map flyTo via setSelectedLocation
       2. Resolve stopId via buildStory and scroll the sheet /
          sidebar to that stop
       3. Mobile: expand the card inline (image + Maps button)
       4. Snap the sheet to 'half' on mobile so the user sees both
          map and list. */
  const handleSearchSelect = useCallback((item) => {
    if (!item) return;
    setSelectedLocation({
      lng: item.coordinates.lng,
      lat: item.coordinates.lat,
      name: item.name,
    });
    sheetRef.current?.snapTo?.("half");
    import("../data/storyBuilder").then(({ buildStory }) => {
      const story = buildStory();
      const match = story.find((it) =>
        it.type === "stop" &&
        it.day === item.day &&
        ((it.titleEn || "").trim() === item.name.trim())
      );
      if (match) {
        setActiveStopId(match.stopId);
        setTimeout(() => {
          storyMobRef.current?.expandStop?.(match.stopId);
          storyDeskRef.current?.scrollToStop?.(match.stopId);
        }, 80);
      }
    });
  }, []);

  /* Sheet-gesture callbacks for the mobile StoryFlow scrollspy:
     stepping UP grows the sheet (peek → half → full); stepping
     DOWN shrinks it. Idempotent at the endpoints. */
  const handleSheetStepUp = useCallback(() => {
    const cur = sheetRef.current?.getSnap?.();
    if (cur === "peek") sheetRef.current?.snapTo?.("half");
    else if (cur === "half") sheetRef.current?.snapTo?.("full");
  }, []);
  const handleSheetStepDown = useCallback(() => {
    const cur = sheetRef.current?.getSnap?.();
    if (cur === "full") sheetRef.current?.snapTo?.("half");
    else if (cur === "half") sheetRef.current?.snapTo?.("peek");
  }, []);

  const storyProps = useMemo(() => ({
    activeStopId,
    onSelectStop:    handleSelectStop,
    onOpenDetail:    handleOpenDetail,
    activeDay:       selectedDay,
    onSelectDay:     handleSelectDay,
    /* Hierarchical filter wiring */
    activeCityKey:   activeCity,
    activeCategory:  activeFilter,
    onCityChange:    handleCityChange,
    onCategoryChange: handleFilterChange,
    onClearFilters:  handleClearFilters,
  }), [
    activeStopId, handleSelectStop, handleOpenDetail,
    selectedDay, handleSelectDay,
    activeCity, activeFilter,
    handleCityChange, handleFilterChange, handleClearFilters,
  ]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: "var(--paper)",
      }}
    >
      {/* ═══ MAP (flex:1) ═══════════════════════════════════════ */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <MapComponent
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
          selectedLocation={selectedLocation}
          onOpenDetail={handleOpenDetail}
          activeFilter={activeFilter}
          activeCity={activeCity}
          onFilterChange={handleFilterChange}
          onCityChange={handleCityChange}
          macroSignal={macroSignal}
        />

        {/* Map-overlay buttons — single cluster shown on both mobile
            and desktop. Used to render twice (pills on desktop +
            tiny duplicate icons on mobile) which created the
            visible orphan-button stack at top-right. */}
        <div
          style={{
            position: "absolute",
            top: 16, left: 16,
            display: "flex", gap: 8,
            zIndex: 10,
            flexWrap: "wrap",
          }}
        >
          <Link to="/" title="חזרה לבית" style={overlayBtn}>
            <MetaIcon name="home" color="#FDFCF7" />
            <span style={{ fontSize: 11 }}>בית</span>
          </Link>
          <button onClick={handleMacroView} title="כל הטיול" style={overlayBtn}>
            <MetaIcon name="globe" color="#FDFCF7" />
            <span style={{ fontSize: 11 }}>כל הטיול</span>
          </button>
          {/* "הרחב מפה" only makes sense on desktop where a sidebar
              exists to collapse. Hidden on mobile. */}
          <button
            onClick={() => setPanelCollapsed((v) => !v)}
            title={panelCollapsed ? "פתח את הסיפור" : "הרחב מפה"}
            style={overlayBtn}
            className="hidden lg:inline-flex"
          >
            <MetaIcon name="expand" color="#FDFCF7" />
            <span style={{ fontSize: 11 }}>
              {panelCollapsed ? "פתח סיפור" : "הרחב מפה"}
            </span>
          </button>
        </div>

        {/* Omnibox search — circular icon on mobile (top-right),
            permanent pill bar on desktop (top-right). */}
        <div className="lg:hidden">
          <OmniboxSearch variant="mobile" onSelect={handleSearchSelect} />
        </div>
        <div className="hidden lg:block">
          <OmniboxSearch variant="desktop" onSelect={handleSearchSelect} />
        </div>
      </div>

      {/* ═══ DESKTOP STORY PANEL (560px, collapsible) ═══════════
            Desktop now uses the SAME compact (edge-spine, right-
            aligned) layout as mobile. The earlier zigzag layout
            put medallions at the panel centre — in a 560px panel
            the two columns ended up so cramped that the spine and
            icons looked clipped against the alternating content.
            The unified edge-spine reads cleanly at any width.    */}
      {!panelCollapsed && (
        <div
          className="hidden lg:flex story-flow-desktop"
          style={{
            width: 560,
            flexShrink: 0,
            height: "100%",
            borderLeft: "1px solid var(--line)",
          }}
        >
          <StoryFlow
            ref={storyDeskRef}
            {...storyProps}
            onClose={() => setPanelCollapsed(true)}
            compact={true}
            /* Desktop: no inline expand, no modal — clicking a stop
               only flies the map + shows the map popup. */
            inlineExpand={false}
          />
        </div>
      )}

      {/* Collapsed panel handle — peek tab on the right edge */}
      {panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="hidden lg:flex"
          style={{
            position: "absolute",
            top: "50%", right: 0,
            transform: "translateY(-50%)",
            width: 36, height: 80,
            borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
            border: "1px solid var(--line)",
            borderRight: "none",
            background: "var(--paper)",
            cursor: "pointer",
            color: "var(--ink-2)",
            alignItems: "center", justifyContent: "center",
            zIndex: 11,
            boxShadow: "-2px 4px 14px rgba(28,35,51,0.08)",
          }}
          title="פתח את סיפור הטיול"
        >
          <span style={{ fontSize: 18 }}>‹</span>
        </button>
      )}

      {/* ═══ MOBILE BOTTOM SHEET (compact StoryFlow inside) ═══ */}
      <BottomSheet ref={sheetRef} defaultSnap="half">
        <StoryFlow
          ref={storyMobRef}
          {...storyProps}
          compact={true}
          /* Mobile: inline expansion inside the sheet. The detail
             modal is no longer shown — tapping a card expands it
             in place (atmosphere photo + full description). */
          inlineExpand={true}
          /* Sheet-gesture coupling — scrolling inside the list grows
             the sheet; overscrolling at the top shrinks it. */
          onSheetStepUp={handleSheetStepUp}
          onSheetStepDown={handleSheetStepDown}
        />
      </BottomSheet>

      {/* Detail modal has been REMOVED — stop selection now uses
          inline expand (mobile) or the map popup (desktop). The
          modalData state + setter are kept for backward compat
          but no longer surface a UI. */}
    </div>
  );
};

/* ─── Overlay button styles — solid black to mirror the home-page
   "Interactive Map" CTA. Clean and high-contrast on top of the
   map. flex-centered on both axes so the icon + label stay
   perfectly aligned regardless of label length. */
const overlayBtn = {
  height: 36,
  padding: "0 16px",
  border: "1px solid #1C2333",
  background: "#1C2333",
  borderRadius: 18,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 6,
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  color: "#FDFCF7",
  textDecoration: "none",
  fontWeight: 600,
  whiteSpace: "nowrap",
  lineHeight: 1,
};

/* miniBtn removed — the mobile mini-icon cluster was a duplicate
   of the pill cluster and triggered the visible "orphan buttons"
   stack at top-right. The single overlayBtn cluster now serves
   both viewports. */

export default ExploreView;
