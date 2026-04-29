import React, { useState, useCallback, useRef, useEffect } from "react";
import MapComponent from "./components/MapComponent";
import ItineraryList from "./components/ItineraryList";
import DetailModal from "./components/DetailModal";

/* ══════════════════════════════════════════════════════════════
   DRAGGABLE DIVIDER
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
      {/* Visible line */}
      <div className="w-[3px] flex-1 rounded-full bg-gradient-to-b from-cream-300 via-vermillion-400 to-cream-300 group-hover:w-[5px] group-hover:bg-gradient-to-b group-hover:from-vermillion-300 group-hover:via-vermillion-500 group-hover:to-vermillion-300 transition-all duration-150" />
      {/* Drag handle dots */}
      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
        <div className="w-1 h-1 rounded-full bg-vermillion-400" />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   APP
   ══════════════════════════════════════════════════════════════ */
const App = () => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showMap, setShowMap] = useState(true);
  // Single-select: active category key (string | null)
  const [activeFilter, setActiveFilter] = useState(null);
  // Single-select: active chronological city key (string | null)
  const [activeCity, setActiveCity] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [modalData, setModalData] = useState(null);
  // Draggable divider: map panel width as percentage (desktop)
  const [mapWidthPct, setMapWidthPct] = useState(50);
  const containerRef = useRef(null);

  const handleSelectDay = useCallback((day) => {
    setSelectedDay(day);
    setSelectedLocation(null);
  }, []);

  const handleSelectLocation = useCallback((location) => {
    setSelectedLocation(location);
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

  /* ── Single-select filter: click toggles on/off
        When a NEW filter is activated we also clear any prior
        day/location selection so the map can refocus to the
        filter's bounds without getting "stuck" on a single day. ── */
  const handleFilterChange = useCallback((key) => {
    setActiveFilter((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        setSelectedDay(null);
        setSelectedLocation(null);
      }
      // City key semantics differ between chronological (e.g. "Tokyo#1")
      // and consolidated (e.g. "Tokyo") paths. Clear on mode switch so
      // a stale key doesn't accidentally match the other mode.
      setActiveCity(null);
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilter(null);
    setActiveCity(null);
  }, []);

  const handleCityChange = useCallback((cityKey) => {
    setActiveCity((prev) => (prev === cityKey ? null : cityKey));
    setSelectedDay(null);
    setSelectedLocation(null);
  }, []);

  /* ── Draggable divider handler ── */
  const handleDividerDrag = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setMapWidthPct(Math.min(75, Math.max(25, pct)));
  }, []);

  return (
    <div className="h-screen w-screen bg-vermillion-500 p-2 lg:p-3">
      <div
        ref={containerRef}
        className="h-full w-full bg-cream-50 rounded-lg overflow-hidden border border-vermillion-500/20 flex flex-col lg:flex-row shadow-2xl"
      >
        {/* Mobile toggle bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-cream-50 border-b border-cream-300 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-sumi-800 rounded flex items-center justify-center">
              <span className="text-[8px] font-display font-black text-sumi-800 leading-none tracking-tighter">JP<br/>N</span>
            </div>
            <span className="text-sm font-display font-bold text-sumi-800">日本旅行</span>
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-semibold bg-vermillion-500 text-white hover:bg-vermillion-600 transition-colors shadow-sm min-h-[44px]"
          >
            {showMap ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Trip Roadmap
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
                Map
              </>
            )}
          </button>
        </div>

        {/* Map panel — dynamic width via draggable divider */}
        <div
          data-panel="map"
          className={`relative z-0 transition-all ease-in-out ${
            mapExpanded ? "lg:w-full lg:block duration-500" : "lg:block duration-100"
          } ${showMap ? "max-lg:flex-1 max-lg:min-h-0 block lg:h-full" : "hidden"}`}
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
            />
          </div>
          {/* Full-screen map toggle */}
          <button
            onClick={handleToggleMapExpand}
            className="hidden lg:flex absolute top-4 left-14 z-10 items-center gap-1.5 px-3 py-2 bg-cream-50/95 backdrop-blur-sm rounded-lg border border-cream-300 hover:border-vermillion-300 shadow-md text-[11px] font-display font-bold text-sumi-700 hover:text-vermillion-600 transition-all duration-200 min-h-[44px]"
            title={mapExpanded ? "Show Trip Roadmap" : "Expand map"}
          >
            {mapExpanded ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="11 19 2 12 11 5" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                </svg>
                Show Trip Roadmap
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                Expand Map
              </>
            )}
          </button>
        </div>

        {/* Draggable divider (desktop only, not in expanded mode) */}
        {!mapExpanded && (
          <DraggableDivider onDrag={handleDividerDrag} />
        )}

        {/* Itinerary panel */}
        <div
          data-panel="itinerary"
          className={`transition-all ease-in-out ${
            mapExpanded
              ? "lg:w-0 lg:hidden duration-500"
              : "lg:block duration-100"
          } ${showMap ? "hidden lg:block" : "block"} flex-1 overflow-hidden`}
        >
          <ItineraryList
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            onSelectLocation={handleSelectLocation}
            activeFilter={activeFilter}
            activeCity={activeCity}
            onFilterChange={handleFilterChange}
            onCityChange={handleCityChange}
            onClearFilters={handleClearFilters}
            onOpenDetail={handleOpenDetail}
          />
        </div>
      </div>

      {/* Detail Modal */}
      {modalData && (
        <DetailModal
          data={modalData}
          onClose={handleCloseDetail}
          onSelectDay={handleSelectDay}
          onSelectLocation={handleSelectLocation}
        />
      )}

      {/* Dynamic layout CSS for desktop draggable divider */}
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

export default App;
