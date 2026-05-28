import React, { useEffect, useMemo, useRef } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

/* ══════════════════════════════════════════════════════════════
   EditorMap — keyless MapLibre canvas for the trip editor.

   • Renders numbered markers for the active day's stops + a route
     polyline connecting them in order.
   • flyTo recenters when the active day's stop cluster changes.
   • Pinning mode (spec §4B): when `isPinning` is true the cursor
     becomes a crosshair and a map click reports the lngLat via
     onMapPick — the parent then prompts for a label.
   ══════════════════════════════════════════════════════════════ */

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const EditorMap = ({ stops = [], color = "#0D0F11", isPinning = false, onMapPick }) => {
  const mapRef = useRef(null);

  const pts = useMemo(
    () => stops.filter((s) => s.coordinates && Number.isFinite(s.coordinates.lng)),
    [stops]
  );

  /* Fit/fly to the active day's cluster whenever it changes. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].coordinates.lng, pts[0].coordinates.lat], zoom: 14, duration: 700 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    pts.forEach(({ coordinates: c }) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 15, duration: 700 });
    } catch { /* noop */ }
  }, [pts]);

  const routeGeoJSON = useMemo(() => ({
    type: "Feature",
    geometry: { type: "LineString", coordinates: pts.map((s) => [s.coordinates.lng, s.coordinates.lat]) },
  }), [pts]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: pts[0]?.coordinates.lng ?? 139.7, latitude: pts[0]?.coordinates.lat ?? 35.6, zoom: 12 }}
      style={{ width: "100%", height: "100%", cursor: isPinning ? "crosshair" : "grab" }}
      mapStyle={MAP_STYLE}
      attributionControl={false}
      onClick={(e) => {
        if (isPinning && onMapPick) onMapPick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }}
    >
      {pts.length > 1 && (
        <Source id="editor-route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="editor-route-line"
            type="line"
            paint={{ "line-color": color, "line-width": 3, "line-opacity": 0.85, "line-dasharray": [1, 0.6] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
      )}

      {pts.map((s, i) => (
        <Marker key={`${s.name}-${i}`} longitude={s.coordinates.lng} latitude={s.coordinates.lat} anchor="center">
          <div style={{
            width: 26, height: 26, borderRadius: "50%", background: color,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, border: "2px solid #fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
          }}>{i + 1}</div>
        </Marker>
      ))}
    </Map>
  );
};

export default EditorMap;
