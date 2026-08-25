import { useCallback, useEffect, useMemo, useState } from "react";
import tripService from "../services/tripService";
import { dedupeDayStops } from "../utils/classify";
import { listInboxPlaces, addInboxPlaces, removeInboxPlace, updateInboxPlace, fetchMockGoogleSavedPlaces } from "../services/googleSavedPlaces";

/* ══════════════════════════════════════════════════════════════
   useEditorState — the shared "brain" of the trip editor.

   Owns the trip DATA + persistence, decoupled from any presentation.
   Built ADDITIVELY (Stage 1 of the responsive effort): the new
   desktop cockpit (EditorDesktop) consumes this hook. The existing
   mobile EditorView keeps its own inline logic UNTOUCHED for now —
   so this hook can never regress mobile. A later consolidation will
   point mobile at this same hook once both consumers are proven.

   Mirrors EditorView's data contract exactly:
     • fetchTripById(tripId) → trip; activeDay defaults to the first day
     • days = trip.data.tripData
     • commitDays(mutate) applies an immutable mutation + autosaves
       (skipped on read-only trips), identical to the mobile engine.

   Returns { trip, error, saving, days, activeDay, setActiveDay,
             activeDayData, mapStops, editable, commitDays, reload }.
   ══════════════════════════════════════════════════════════════ */

export default function useEditorState(tripId) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeDay, setActiveDay] = useState(1);

  /* Load the trip (owner OR collaborator — RLS/service decides), and default
     the active day to the trip's first day. Identical to EditorView. */
  const reload = useCallback(() => {
    let live = true;
    setTrip(null); setError(null);
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) { setTrip(t); setActiveDay(t.data?.tripData?.[0]?.day ?? 1); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tripId]);

  useEffect(() => reload(), [reload]);

  /* Immutable day-array mutation + autosave — a byte-for-byte match of the
     mobile commitDays so behavior/persistence stay identical across surfaces. */
  const commitDays = useCallback((mutate) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextDays = mutate((prev.data.tripData || []).map((d) => ({ ...d, attractions: [...(d.attractions || [])] })));
      const nextTrip = { ...prev, data: { ...prev.data, tripData: nextDays } };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextTrip.data }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);

  const days = useMemo(() => trip?.data?.tripData ?? [], [trip]);

  const activeDayData = useMemo(
    () => days.find((d) => d.day === activeDay) || null,
    [days, activeDay]
  );

  /* The active day's plottable stops (non-transit, with finite coordinates). */
  const mapStops = useMemo(
    () => (activeDayData?.attractions ?? []).filter(
      (s) => !s._transit && s.coordinates
        && Number.isFinite(s.coordinates.lat) && Number.isFinite(s.coordinates.lng)
    ),
    [activeDayData]
  );

  const editable = !!trip && !trip.readOnly;

  /* ── Editing handlers (day-array mutations via commitDays) ──
     Keyed by (dayNum, index-into-attractions). Additive: only the desktop
     cockpit uses these; mobile keeps its own inline handlers. */
  const genId = () => (
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );

  const deleteStopAt = useCallback((dayNum, idx) => {
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d));
  }, [commitDays]);

  const duplicateStopAt = useCallback((dayNum, idx) => {
    commitDays((ds) => ds.map((d) => {
      if (d.day !== dayNum) return d;
      const src = d.attractions[idx];
      if (!src) return d;
      const clone = { ...src, instanceId: genId() };
      return { ...d, attractions: [...d.attractions.slice(0, idx + 1), clone, ...d.attractions.slice(idx + 1)] };
    }));
  }, [commitDays]);

  const moveStopToDay = useCallback((fromDay, idx, toDay) => {
    if (fromDay === toDay) return;
    commitDays((ds) => {
      const from = ds.find((d) => d.day === fromDay);
      const moved = from?.attractions[idx];
      if (!moved) return ds;
      return ds.map((d) => {
        if (d.day === fromDay) return { ...d, attractions: d.attractions.filter((_, i) => i !== idx) };
        if (d.day === toDay) return { ...d, attractions: [...d.attractions, moved] };
        return d;
      });
    });
  }, [commitDays]);

  const setStopNote = useCallback((dayNum, idx, note) => {
    const clean = (note || "").trim();
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...a, note: clean || undefined } : a) } : d));
  }, [commitDays]);

  /* Sprint (desktop) — add a searched place to a day (the core planning act). */
  const addStopToDay = useCallback((dayNum, stop) => {
    if (!stop) return;
    const withId = { ...stop, instanceId: genId() };
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: dedupeDayStops([...d.attractions, withId]) } : d));
  }, [commitDays]);

  /* Insert any node (transit segment or standalone note) at a REAL index in a
     day — powers the inline "+" between rows (quick add mid-itinerary). */
  const insertAt = useCallback((dayNum, idx, node) => {
    if (!node) return;
    const withId = { ...node, instanceId: genId() };
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: [...d.attractions.slice(0, idx), withId, ...d.attractions.slice(idx)] } : d));
  }, [commitDays]);

  /* Append a transit/flight segment to a day (a _transit-flagged, coordinate-
     less node — it lives in the timeline but never plots on the map). */
  const addTransitToDay = useCallback((dayNum, transit) => {
    if (!transit) return;
    const withId = { ...transit, instanceId: genId() };
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: [...d.attractions, withId] } : d));
  }, [commitDays]);

  /* Replace the attraction at a REAL index (used to save a transit edit),
     preserving its instanceId so React keys + identity stay stable. */
  const updateStopAt = useCallback((dayNum, idx, next) => {
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...next, instanceId: a.instanceId } : a) } : d));
  }, [commitDays]);

  /* Attach an uploaded file's metadata to a stop (append to attachments[]). */
  const addAttachmentToStop = useCallback((dayNum, idx, meta) => {
    if (!meta) return;
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: d.attractions.map((a, i) => i === idx
          ? { ...a, attachments: [...(a.attachments || []), meta] } : a) } : d));
  }, [commitDays]);

  /* Remove the attachment at position `fi` from a stop. */
  const removeAttachmentAt = useCallback((dayNum, idx, fi) => {
    commitDays((ds) => ds.map((d) => d.day === dayNum
      ? { ...d, attractions: d.attractions.map((a, i) => i === idx
          ? { ...a, attachments: (a.attachments || []).filter((_, k) => k !== fi) } : a) } : d));
  }, [commitDays]);

  const reorderInDay = useCallback((dayNum, from, to) => {
    commitDays((ds) => ds.map((d) => {
      if (d.day !== dayNum) return d;
      const arr = [...d.attractions];
      const [m] = arr.splice(from, 1);
      if (!m) return d;
      arr.splice(to, 0, m);
      return { ...d, attractions: arr };
    }));
  }, [commitDays]);

  /* Commit a wholesale reordering of a day's attractions (used by the desktop
     pointer-drag reorder, which hands back the full array in its new order).
     Guarded to only accept a same-length permutation so a mid-drag glitch can
     never drop or duplicate a stop. */
  const setDayOrder = useCallback((dayNum, nextAttractions) => {
    commitDays((ds) => ds.map((d) => {
      if (d.day !== dayNum) return d;
      if (!Array.isArray(nextAttractions) || nextAttractions.length !== (d.attractions || []).length) return d;
      return { ...d, attractions: [...nextAttractions] };
    }));
  }, [commitDays]);

  /* ── Places Inbox ("בנק נקודות") ───────────────────────────────
     A saved-points pile decoupled from any single day (Supabase table
     with a session, localStorage otherwise). The desktop cockpit reads
     it into a side drawer; mobile keeps its own inline inbox state.
     `inbox === null` means "not loaded yet". */
  const [inbox, setInbox] = useState(null);
  const [inboxLoading, setInboxLoading] = useState(false);

  const loadInbox = useCallback(() => {
    setInboxLoading(true);
    listInboxPlaces()
      .then((list) => setInbox(list || []))
      .catch(() => setInbox([]))
      .finally(() => setInboxLoading(false));
  }, []);

  /* Map an inbox POI (flat lat/lng) into a day-stop (coordinates object). */
  const placeToStop = (p) => ({
    name: p.name,
    nameHe: p.nameHe || p.name,
    category: p.category || "אטרקציה",
    rating: p.rating || "",
    coordinates: { lat: p.lat, lng: p.lng },
    photoUrl: p.photoUrl || p.photo_url || "",
    /* Keep identity + the personal note when a saved point lands on a day. */
    place_id: p.place_id || undefined,
    note: p.note || undefined,
  });

  /* Assign a saved point into a day (single-home model: it leaves the pile). */
  const assignInboxToDay = useCallback((place, dayNum) => {
    if (!place) return;
    addStopToDay(dayNum, placeToStop(place));
    removeInboxPlace(place.id).catch(() => {});
    setInbox((prev) => (prev || []).filter((p) => p.id !== place.id));
  }, [addStopToDay]);

  const removeFromInbox = useCallback((id) => {
    removeInboxPlace(id).catch(() => {});
    setInbox((prev) => (prev || []).filter((p) => p.id !== id));
  }, []);

  /* Edit a saved bank point's personal note (persists to the bank AND updates
     the list so it shows immediately). */
  const updateInboxNote = useCallback((id, note) => {
    updateInboxPlace(id, { note }).catch(() => {});
    setInbox((prev) => (prev || []).map((p) => (p.id === id ? { ...p, note: (note || "").trim() || undefined } : p)));
  }, []);

  /* Empty-state "connect": seed the pile with the mock Google Saved Places
     (mirrors the mobile connect CTA) so the drawer is immediately useful. */
  const connectSavedPlaces = useCallback((center) => {
    setInboxLoading(true);
    fetchMockGoogleSavedPlaces(center)
      .then((list) => addInboxPlaces(list))
      .then(() => listInboxPlaces())
      .then((list) => setInbox(list || []))
      .catch(() => {})
      .finally(() => setInboxLoading(false));
  }, []);

  /* Move a day-stop OUT of the itinerary and INTO the manual points bank
     (mirrors the mobile "העבר לבנק" — the bank is populated by hand, never
     auto-imported). Requires coordinates to be plottable in the bank. */
  const moveStopToInbox = useCallback((dayNum, idx) => {
    const day = (trip?.data?.tripData || []).find((d) => d.day === dayNum);
    const stop = day?.attractions?.[idx];
    if (!stop) return;
    deleteStopAt(dayNum, idx);
    const c = stop.coordinates;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      addInboxPlaces([{
        name: stop.name, nameHe: stop.nameHe || stop.name,
        category: stop.category || "אטרקציה", rating: stop.rating || "",
        lat: c.lat, lng: c.lng, source: "desktop",
        /* Preserve the stop's identity + note when it moves to the bank. */
        place_id: stop.place_id || undefined, photoUrl: stop.photoUrl || undefined, note: stop.note || undefined,
      }]).then((saved) => setInbox((prev) => ([...(saved || []), ...(prev || [])]))).catch(() => {});
    }
  }, [trip, deleteStopAt]);

  /* Manual map pin (long-press) → save to a specific day OR the points bank.
     `target` is { day: N } or { inbox: true }. This is the desktop equivalent
     of the mobile long-press "save a point" flow. */
  const saveCustomPin = useCallback((payload, target) => {
    if (!payload) return;
    const c = payload.coordinates;
    if (target && target.day != null) {
      addStopToDay(target.day, {
        name: payload.name, nameHe: payload.name, category: "אטרקציה",
        coordinates: c, note: payload.note || undefined,
      });
    } else if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      addInboxPlaces([{
        name: payload.name, nameHe: payload.name, category: "אטרקציה",
        lat: c.lat, lng: c.lng, source: "desktop-pin", note: payload.note || undefined,
      }]).then((saved) => setInbox((prev) => ([...(saved || []), ...(prev || [])]))).catch(() => {});
    }
  }, [addStopToDay]);

  /* Manually add a searched place straight into the points bank (not a day) —
     the desktop equivalent of hand-saving a point. Requires coordinates. */
  const addSearchedToInbox = useCallback((stop) => {
    const c = stop?.coordinates;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    addInboxPlaces([{
      name: stop.name, nameHe: stop.nameHe || stop.name,
      category: stop.category || "אטרקציה", rating: stop.rating || "",
      lat: c.lat, lng: c.lng, source: "desktop-search",
      /* Carry identity + the personal note so the bank card shows the real
         photo, opens the real listing, and keeps the note (parity with mobile). */
      place_id: stop.place_id || stop.placeId || undefined,
      photoUrl: stop.photoUrl || undefined,
      note: stop.note || undefined,
    }]).then((saved) => setInbox((prev) => ([...(saved || []), ...(prev || [])]))).catch(() => {});
  }, []);

  /* Add a new empty day at the end of the trip and jump to it. Persists via
     commitDays (the skeleton + every consumer update automatically). */
  const addDay = useCallback(() => {
    const list = trip?.data?.tripData || [];
    const maxDay = list.reduce((m, d) => Math.max(m, d.day || 0), 0);
    const newDayNum = maxDay + 1;
    const last = list[list.length - 1] || {};
    commitDays((ds) => [...ds, { day: newDayNum, city: last.city, cityHe: last.cityHe, attractions: [] }]);
    setActiveDay(newDayNum);
  }, [trip, commitDays]);

  return {
    trip, error, saving,
    days, activeDay, setActiveDay, activeDayData, mapStops,
    editable, commitDays, reload,
    deleteStopAt, duplicateStopAt, moveStopToDay, setStopNote, reorderInDay, setDayOrder, addStopToDay,
    addTransitToDay, updateStopAt, addAttachmentToStop, removeAttachmentAt, insertAt,
    addDay, moveStopToInbox, saveCustomPin, addSearchedToInbox,
    inbox, inboxLoading, loadInbox, assignInboxToDay, removeFromInbox, updateInboxNote, connectSavedPlaces,
  };
}
