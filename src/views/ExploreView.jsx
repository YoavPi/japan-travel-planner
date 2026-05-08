import React, { useState, useCallback, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapComponent from "../components/MapComponent";
import DetailModal from "../components/DetailModal";
import BottomSheet from "../components/BottomSheet";
import BottomFilterBar from "../components/BottomFilterBar";
import VerticalFlow from "../components/VerticalFlow";
import DayFilter from "../components/DayFilter";

/* ══════════════════════════════════════════════════════════════
   DRAGGABLE DIVIDER (desktop split-pane resize)
   ══════════════════════════════════════════════════════════════ */
const DraggableDivider = ({ onDrag }) => {
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev) => {
      if (!isDragging.current) return;
      onDrag(ev.clientX);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="hidden lg:flex lg:flex-col items-center cursor-col-resize group z-10 px-1 hover:px-0.5 transition-all"
      title="Drag to resize"
    >
      <div className="w-[3px] flex-1 rounded-full bg-gradient-to-b from-cream-300 via-vermillion-400 to-cream-300 group-hover:w-[5px] group-hover:bg-gradient-to-b group-hover:from-vermillion-300 group-hover:via-vermillion-500 group-hover:to-vermillion-300 transition-all duration-150" />
      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   EXPLORE VIEW — Map + VerticalFlow (sprint/spatial-flow-redesign)
   ──────────────────────────────────────────────────────────────
   Desktop (lg+):
     [Map  | divider |  RightPane{ VerticalFlow + footer Filters }]
   Mobile (<lg):
     [Full-screen Map]
     [BottomSheet over map: Filters + VerticalFlow]
   ══════════════════════════════════════════════════════════════ */
const ExploreView = () => {
  const [searchParams] = useSearchParams();

  // ── Existing state
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [activeCity, setActiveCity] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [mapWidthPct, setMapWidthPct] = useState(50);

  // ── New: macro-view signal (incrementing counter triggers fitBounds in map)
  const [macroSignal, setMacroSignal] = useState(0);

  // ── Refs
  const containerRef = useRef(null);
  const sheetRef = useRef(null);
  const flowRefMobile = useRef(null);
  const flowRefDesktop = useRef(null);

  /* ── Deep-link query params on mount: ?city= and ?day= ── */
  useEffect(() => {
    const cityParam = searchParams.get("city");
    const dayParam = searchParams.get("day");
    if (cityParam) setActiveCity(cityParam);
    if (dayParam) {
      const dayNum = parseInt(dayParam, 10);
      if (!Number.isNaN(dayNum)) setSelectedDay(dayNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Map → flow sync: scroll the visible flow to the selected day ── */
  useEffect(() => {
    if (selectedDay == null) return;
    /* Both refs may exist (CSS-hidden on the inactive breakpoint).
       Calling scrollIntoView on the hidden one is a no-op. */
    setTimeout(() => {
      flowRefMobile.current?.scrollToDay?.(selectedDay);
      flowRefDesktop.current?.scrollToDay?.(selectedDay);
    }, 60);
    /* Mobile only: when the sheet is tucked at peek and a day is
       selected, snap it open. There's no mid-state — the sheet is
       either at the bottom (peek) or the top (full). */
    if (sheetRef.current?.getSnap?.() === "peek") {
      sheetRef.current.snapTo("full");
    }
  }, [selectedDay]);

  /* ── State handlers (stable) ── */
  const handleSelectDay = useCallback((day) => {
    setSelectedDay(day);
    setSelectedLocation(null);
  }, []);

  const handleSelectLocation = useCallback((location) => {
    setSelectedLocation(location);
    /* Mobile UX: tapping a specific location means the user wants
       to see it on the map. Drop the sheet to peek so the map
       (with its popup anchored to the marker) is fully visible. */
    if (sheetRef.current?.getSnap?.() === "full") {
      sheetRef.current.snapTo("peek");
    }
  }, []);

  const handleOpenDetail = useCallback((data) => {
    setModalData(data);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setModalData(null);
  }, []);

  const handleToggleMapExpand = useCallback(() => {
    setMapExpanded((prev) => !prev);
  }, []);

  const handleFilterChange = useCallback((key) => {
    setActiveFilter((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        setSelectedDay(null);
        setSelectedLocation(null);
        /* Mobile: a category filter switches the sheet into the
           city-grouped browse view, which needs full height to
           breathe. Snap to full on activation. */
        sheetRef.current?.snapTo?.("full");
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilter(null);
    setActiveCity(null);
    setSelectedDay(null);
    setSelectedLocation(null);
  }, []);

  const handleCityChange = useCallback((cityKey) => {
    setActiveCity((prev) => (prev === cityKey ? null : cityKey));
    setSelectedDay(null);
    setSelectedLocation(null);
    /* Per the spec, city selection alone doesn't change the sheet
       snap state — only day selection (→ half) or category filter
       activation (→ full) do. The user keeps their current view. */
  }, []);

  /* ── Macro view: clear all filters and trigger map fitBounds-all ── */
  const handleMacroView = useCallback(() => {
    setSelectedDay(null);
    setSelectedLocation(null);
    setActiveFilter(null);
    setActiveCity(null);
    setMacroSignal((s) => s + 1);
    /* Mobile: collapse sheet so the macro view is fully visible */
    sheetRef.current?.snapTo?.("peek");
  }, []);

  const handleDividerDrag = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setMapWidthPct(Math.min(75, Math.max(25, pct)));
  }, []);

  /* ── Common props for both flow instances ── */
  const flowProps = {
    selectedDay,
    onSelectDay: handleSelectDay,
    onSelectLocation: handleSelectLocation,
    activeFilter,
    activeCity,
  };

  const filterProps = {
    activeCity,
    activeFilter,
    onCityChange: handleCityChange,
    onFilterChange: handleFilterChange,
    onClearAll: handleClearFilters,
  };

  return (
    <div className="h-screen w-screen bg-cream-100 p-1.5 lg:p-2">
      <div
        ref={containerRef}
        /* RTL note: with `dir="rtl"` set globally, `flex-row-reverse`
           puts the LAST flex child on the visual right and the FIRST
           on the left — i.e. the sidebar (last child) ends up on the
           right exactly as the user expects, while the map sits on
           the left. Mobile (`flex-col`) is unaffected. */
        className="h-full w-full bg-cream-50 rounded-xl overflow-hidden border-[1.5px] border-vermillion-400/35 flex flex-col lg:flex-row-reverse shadow-xl relative"
      >
        {/* ═══ MAP PANEL ═══════════════════════════════════════════
              Full-bleed on mobile (sheet sits on top); split-pane
              on desktop (toggleable expand to full).            ═══ */}
        <div
          data-panel="map"
          className={`relative z-0 max-lg:flex-1 max-lg:min-h-0 max-lg:h-full block lg:h-full transition-all ease-in-out duration-100 ${
            mapExpanded ? "lg:w-full" : ""
          }`}
        >
          <div className="w-full h-full">
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
          </div>

          {/* "כל הימים" (Show All Days) reset button — only visible
              when a day is currently selected. Clears the day so the
              31-point macro view returns. Renders ABOVE the standard
              cluster so it's a distinct affordance. */}
          {selectedDay && (
            <button
              onClick={() => { setSelectedDay(null); setSelectedLocation(null); }}
              className="absolute top-4 left-14 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 bg-vermillion-500 text-white rounded-lg shadow-md text-[11px] font-bold hover:bg-vermillion-600 transition-colors min-h-[40px] max-lg:top-3 max-lg:left-3"
              dir="rtl"
              title="הצג את כל הימים"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              הצג את כל הימים
            </button>
          )}

          {/* Map overlay button cluster — desktop only.
              In RTL the cluster sits on the LEFT edge of the map
              (top-left in physical pixels) since the map itself is
              on the left half of the screen. The cluster is hidden
              on tablet/mobile sizes; mobile gets its own simpler set
              of icon-only buttons (top-right). */}
          <div className={`hidden lg:flex absolute ${selectedDay ? "top-16" : "top-4"} left-14 z-10 gap-2`} dir="rtl">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 hover:border-vermillion-300 shadow-md text-[11px] font-bold text-sumi-700 hover:text-vermillion-600 transition-all duration-200 min-h-[40px]"
              title="חזרה לדף הבית"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              בית
            </Link>
            <button
              onClick={handleMacroView}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 hover:border-vermillion-300 shadow-md text-[11px] font-bold text-sumi-700 hover:text-vermillion-600 transition-all duration-200 min-h-[40px]"
              title="הצג את כל הטיול"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              כל הטיול
            </button>
            <button
              onClick={handleToggleMapExpand}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 hover:border-vermillion-300 shadow-md text-[11px] font-bold text-sumi-700 hover:text-vermillion-600 transition-all duration-200 min-h-[40px]"
              title={mapExpanded ? "הצג פאנל צד" : "הרחב מפה"}
            >
              {mapExpanded ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="11 19 2 12 11 5" /><line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                  הצג מסלול
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  הרחב מפה
                </>
              )}
            </button>
          </div>

          {/* Mobile-only top hint buttons (icons only) */}
          <div className="lg:hidden absolute top-3 right-3 z-10 flex flex-col gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 px-2.5 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 shadow text-[10px] font-bold text-sumi-700 min-h-[40px]"
              title="בית"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <button
              onClick={handleMacroView}
              className="inline-flex items-center gap-1 px-2.5 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 shadow text-[10px] font-bold text-sumi-700 min-h-[40px]"
              title="כל הטיול"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ═══ DESKTOP DIVIDER ═══ */}
        {!mapExpanded && (
          <DraggableDivider onDrag={handleDividerDrag} />
        )}


        {/* ═══ DESKTOP RIGHT PANE — Filters pinned at TOP (like the
              original design), VerticalFlow scrolls beneath. The
              "drawer at bottom" pattern is mobile-only. ═══ */}
        <div
          data-panel="itinerary"
          className={`hidden lg:flex lg:flex-col flex-1 overflow-hidden bg-cream-50 transition-all ease-in-out duration-100 ${
            mapExpanded ? "lg:w-0 lg:hidden" : ""
          }`}
        >
          {/* Sticky title strip — RTL-aligned */}
          <div className="flex-shrink-0 px-5 pt-3 pb-2 border-b border-cream-200 flex items-center justify-between" dir="rtl">
            <div className="text-right">
              <h1 className="text-base font-serif font-black text-sumi-800 tracking-tight">
                מסלול הטיול
              </h1>
              <p className="text-[10px] text-sumi-400 mt-0.5">
                31 ימים · 9 ערים · פברואר–מרץ 2024
              </p>
            </div>
            {selectedDay && (
              <span className="text-[10px] font-bold text-vermillion-600 px-2 py-1 rounded-full bg-vermillion-50 border border-vermillion-200">
                יום {selectedDay}
              </span>
            )}
          </div>

          {/* Day Filter — horizontal pill bar (sticky just under the
              title strip, above the city/category filters). */}
          <div className="flex-shrink-0">
            <DayFilter
              selectedDay={selectedDay}
              onSelectDay={handleSelectDay}
            />
          </div>

          {/* Filter bar — pinned at the top of the side pane (desktop) */}
          <div className="flex-shrink-0">
            <BottomFilterBar {...filterProps} />
          </div>

          {/* Flow scroll area */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
            <VerticalFlow ref={flowRefDesktop} {...flowProps} />
          </div>
        </div>

        {/* ═══ MOBILE BOTTOM SHEET ═══
              Header stack (top → bottom):
                1) Title strip — 'מסלול הטיול' + Home button
                2) DayFilter   — horizontal day pills
                3) BottomFilterBar — city / category filters
              Body: VerticalFlow */}
        <BottomSheet
          ref={sheetRef}
          defaultSnap="peek"
          header={
            <>
              <div
                dir="rtl"
                className="flex items-center justify-between px-4 pt-1 pb-2 border-b border-cream-200"
              >
                <div className="text-right">
                  <h1 className="text-base font-serif font-black text-sumi-800 leading-tight">
                    מסלול הטיול
                  </h1>
                  <p className="text-[10px] text-sumi-400 leading-snug">
                    31 ימים · 9 ערים
                  </p>
                </div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream-100 text-sumi-600 hover:bg-vermillion-50 hover:text-vermillion-600 text-[11px] font-bold transition-colors min-h-[36px] border border-cream-300"
                  title="חזרה לדף הבית"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  בית
                </Link>
              </div>
              <DayFilter selectedDay={selectedDay} onSelectDay={handleSelectDay} />
              <BottomFilterBar {...filterProps} />
            </>
          }
        >
          <VerticalFlow ref={flowRefMobile} {...flowProps} />
        </BottomSheet>
      </div>

      {/* Detail Modal portal */}
      {modalData && (
        <DetailModal
          data={modalData}
          onClose={handleCloseDetail}
          onSelectDay={handleSelectDay}
          onSelectLocation={handleSelectLocation}
        />
      )}

      {/* Dynamic split-pane CSS (desktop only) */}
      {!mapExpanded && (
        <style>{`
          @media (min-width: 1024px) {
            [data-panel="map"] { width: ${mapWidthPct}% !important; }
            [data-panel="itinerary"] { width: ${100 - mapWidthPct}% !important; }
          }
        `}</style>
      )}
    </div>
  );
};

export default ExploreView;
