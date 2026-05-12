import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapComponent from "../components/MapComponent";
import DetailModal from "../components/DetailModal";
import BottomSheet from "../components/BottomSheet";
import StoryFlow from "../components/StoryFlow";
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

  /* Filters are kept around for the MapComponent's existing logic.
     The new StoryFlow doesn't expose them yet — the day-pill row is
     the primary nav. We can re-introduce category filters later. */
  const [activeFilter] = useState(null);
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
  const handleSelectDay = useCallback((day) => {
    setSelectedDay((prev) => prev === day ? prev : day);
    setSelectedLocation(null);
    setActiveStopId(null);
  }, []);

  const handleSelectStop = useCallback((payload) => {
    if (!payload) return;
    setActiveStopId(payload.stopId);
    if (payload.coordinates) {
      setSelectedLocation({
        lng: payload.coordinates.lng,
        lat: payload.coordinates.lat,
        name: payload.name,
      });
    }
    /* Mobile: drop sheet to peek so map+popup are visible */
    if (sheetRef.current?.getSnap?.() === "full") {
      sheetRef.current.snapTo("peek");
    }
  }, []);

  const handleOpenDetail = useCallback((data) => setModalData(data), []);
  const handleCloseDetail = useCallback(() => setModalData(null), []);

  const handleMacroView = useCallback(() => {
    setSelectedDay(null);
    setSelectedLocation(null);
    setActiveStopId(null);
    setActiveCity(null);
    setMacroSignal((s) => s + 1);
    sheetRef.current?.snapTo?.("peek");
  }, []);

  const handleFilterChange = useCallback(() => {}, []);     /* placeholder — filter UI deferred */
  const handleCityChange   = useCallback(() => {}, []);     /* placeholder */

  const storyProps = useMemo(() => ({
    activeStopId,
    onSelectStop: handleSelectStop,
    activeDay: selectedDay,
    onSelectDay: handleSelectDay,
  }), [activeStopId, handleSelectStop, selectedDay, handleSelectDay]);

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

        {/* Desktop map-overlay buttons — top-left cluster
            (Home, Whole Trip, Expand Map) */}
        <div
          className="hidden lg:flex"
          style={{
            position: "absolute",
            top: 16, left: 64,
            display: "flex", gap: 8,
            zIndex: 10,
          }}
        >
          <Link to="/" title="חזרה לבית" style={overlayBtn}>
            <MetaIcon name="home" color="#1C2333" />
            <span style={{ fontSize: 11, fontFamily: "DM Sans, system-ui" }}>בית</span>
          </Link>
          <button onClick={handleMacroView} title="כל הטיול" style={overlayBtn}>
            <MetaIcon name="globe" color="#1C2333" />
            <span style={{ fontSize: 11, fontFamily: "DM Sans, system-ui" }}>כל הטיול</span>
          </button>
          <button
            onClick={() => setPanelCollapsed((v) => !v)}
            title={panelCollapsed ? "פתח את הסיפור" : "הרחב מפה"}
            style={overlayBtn}
          >
            <MetaIcon name="expand" color="#1C2333" />
            <span style={{ fontSize: 11, fontFamily: "DM Sans, system-ui" }}>
              {panelCollapsed ? "פתח סיפור" : "הרחב מפה"}
            </span>
          </button>
        </div>

        {/* Mobile top-right cluster — minimal (Home + Whole Trip) */}
        <div
          className="lg:hidden"
          style={{
            position: "absolute",
            top: 12, right: 12,
            display: "flex", flexDirection: "column", gap: 8,
            zIndex: 10,
          }}
        >
          <Link to="/" title="בית" style={{ ...miniBtn, padding: 8 }}>
            <MetaIcon name="home" color="#1C2333" size={14} />
          </Link>
          <button onClick={handleMacroView} title="כל הטיול" style={{ ...miniBtn, padding: 8 }}>
            <MetaIcon name="globe" color="#1C2333" size={14} />
          </button>
        </div>
      </div>

      {/* ═══ DESKTOP STORY PANEL (560px, collapsible) ═══════════ */}
      {!panelCollapsed && (
        <div
          className="hidden lg:flex"
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
            compact={false}
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
        />
      </BottomSheet>

      {/* Detail modal portal */}
      {modalData && (
        <DetailModal
          data={modalData}
          onClose={handleCloseDetail}
          onSelectDay={handleSelectDay}
          onSelectLocation={(loc) => setSelectedLocation(loc)}
        />
      )}
    </div>
  );
};

/* ─── Overlay button styles (paper-toned to match StoryFlow) ─── */
const overlayBtn = {
  height: 32,
  padding: "0 12px",
  border: "1px solid rgba(28,35,51,0.12)",
  background: "#FDFCF7",
  borderRadius: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  boxShadow: "0 2px 8px rgba(28,35,51,0.06)",
  color: "#1C2333",
  textDecoration: "none",
};

const miniBtn = {
  width: 36, height: 36,
  border: "1px solid rgba(28,35,51,0.12)",
  background: "#FDFCF7",
  borderRadius: 10,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 8px rgba(28,35,51,0.06)",
  color: "#1C2333",
  textDecoration: "none",
};

export default ExploreView;
