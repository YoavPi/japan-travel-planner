import { useCallback, useEffect, useMemo, useState } from "react";
import tripService from "../services/tripService";
import { dedupeDayStops } from "../utils/classify";
import { listInboxPlaces, addInboxPlaces, removeInboxPlace, updateInboxPlace, fetchMockGoogleSavedPlaces } from "../services/googleSavedPlaces";
import { addGeneralFile, updateGeneralFile, removeGeneralFile, renameStopAttachment, remapFileDays } from "../utils/tripFiles";
import {
  remapExpenseDays, ensureBudget, addExpense, updateExpense, removeExpense,
  expensesForStop, detachStopExpenses,
} from "../utils/budget";

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

  /* Like commitDays, but for non-tripData slices of trip.data (currently
     data.files[]). Immutable patch + autosave, skipped on read-only trips. */
  const commitData = useCallback((mutate) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextData = mutate(prev.data || {});
      const nextTrip = { ...prev, data: nextData };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextData }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);

  const days = useMemo(() => trip?.data?.tripData ?? [], [trip]);

  const tripFiles = useMemo(() => trip?.data?.files ?? [], [trip]);

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
    commitData((data) => {
      const day = (data.tripData || []).find((d) => d.day === dayNum);
      const stop = day?.attractions?.[idx];
      const nextTripData = (data.tripData || []).map((d) => d.day === dayNum
        ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d);
      if (!data.budget || !stop?.instanceId) return { ...data, tripData: nextTripData };
      return { ...data, tripData: nextTripData,
        budget: { ...data.budget, items: detachStopExpenses(data.budget.items, stop.instanceId) } };
    });
  }, [commitData]);

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

  /* Per-stop cost (Phase B). One expense per stop — saveStopCost creates or
     updates it. Stamps a lazy instanceId if the stop doesn't have one yet
     (most stops from the AI pipeline / wizard / seed data don't), and does
     the stamp + the budget write in ONE commitData call: two separate
     commits here would risk the second one saving over a stale snapshot of
     the first, per the itinerary-vs-budget single-writer rule this phase is
     built around. */
  const saveStopCost = useCallback((dayNum, idx, payload) => {
    commitData((data) => {
      const day = (data.tripData || []).find((d) => d.day === dayNum);
      const stop = day?.attractions?.[idx];
      if (!stop) return data;
      let stopId = stop.instanceId;
      let nextTripData = data.tripData;
      if (!stopId) {
        stopId = genId();
        nextTripData = data.tripData.map((d) => d.day !== dayNum ? d : {
          ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...a, instanceId: stopId } : a),
        });
      }
      const withBudget = ensureBudget({ ...data, tripData: nextTripData });
      const existing = expensesForStop(withBudget.budget.items, stopId)[0];
      const next = existing
        ? updateExpense(withBudget, existing.id, payload)
        : addExpense(withBudget, { ...payload, stopRef: stopId });
      return next;
    });
  }, [commitData]);

  const removeStopCost = useCallback((expenseId) => {
    commitData((data) => removeExpense(data, expenseId));
  }, [commitData]);

  const costForStop = useCallback((stopId) => {
    const items = trip?.data?.budget?.items || [];
    return expensesForStop(items, stopId)[0] || null;
  }, [trip]);

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

  /* ── Trip-level ("general") files: trip.data.files[] ──────────── */
  const addTripFile = useCallback((meta) => {
    if (!meta) return;
    commitData((data) => addGeneralFile(data, meta));
  }, [commitData]);

  const updateTripFile = useCallback((id, patch) => {
    commitData((data) => updateGeneralFile(data, id, patch));
  }, [commitData]);

  const removeTripFile = useCallback((id) => {
    commitData((data) => removeGeneralFile(data, id));
  }, [commitData]);

  /* Rename one per-stop attachment (writes `label`, leaves siblings intact). */
  const renameAttachmentAt = useCallback((dayNum, stopIdx, fi, label) => {
    commitDays((ds) => renameStopAttachment(ds, dayNum, stopIdx, fi, label));
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
      /* Trip-scoped save: this stop already belonged to THIS trip's day
         ("העבר לבנק הנקודות" — no "כללי"/general wording), unlike the
         search/pin flows which explicitly promise the general bank. */
      addInboxPlaces([{
        name: stop.name, nameHe: stop.nameHe || stop.name,
        category: stop.category || "אטרקציה", rating: stop.rating || "",
        lat: c.lat, lng: c.lng, source: "desktop",
        /* Preserve the stop's identity + note when it moves to the bank. */
        place_id: stop.place_id || undefined, photoUrl: stop.photoUrl || undefined, note: stop.note || undefined,
      }], tripId).then((saved) => setInbox((prev) => ([...(saved || []), ...(prev || [])]))).catch(() => {});
    }
  }, [trip, deleteStopAt, tripId]);

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

  /* Remove a day entirely (its stops included) and renumber 1..N so the strip
     stays sequential — mirrors the mobile day-reorder convention. Never deletes
     the last remaining day. */
  const deleteDay = useCallback((dayNum) => {
    const curLen = (trip?.data?.tripData || []).length;
    if (curLen <= 1) return;
    /* One atomic save: renumber the days AND remap data.files[].day in the
       same commitData write, so a general file tagged to a shifted/removed
       day can never point at the wrong day (or a day that no longer exists). */
    commitData((data) => {
      const arr = data.tripData || [];
      if (arr.length <= 1) return data;
      const filtered = arr.filter((d) => d.day !== dayNum);
      if (filtered.length === arr.length) return data;
      const mapping = { [dayNum]: null };
      filtered.forEach((d, i) => { mapping[d.day] = i + 1; });
      const renumbered = filtered.map((d, i) => ({ ...d, day: i + 1 }));
      return {
        ...data,
        tripData: renumbered,
        files: remapFileDays(data.files, mapping, renumbered.length),
        /* Standalone expenses follow the same rule as general files: a
           removed day folds them back to "general" rather than dropping
           them. Stop-linked expenses are skipped — their day is derived. */
        ...(data.budget ? {
          budget: { ...data.budget, items: remapExpenseDays(data.budget.items, mapping, renumbered.length) },
        } : {}),
      };
    });
    const newLen = Math.max(1, curLen - 1);
    setActiveDay((cur) => Math.min(Math.max(1, cur > dayNum ? cur - 1 : cur), newLen));
  }, [trip, commitData]);

  /* Set/modify the trip's calendar start date (settings.startDate). */
  const saveStartDate = useCallback((iso) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextSettings = { ...(prev.settings || {}), startDate: iso || null };
      const nextTrip = { ...prev, settings: nextSettings };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { settings: nextSettings }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);

  /* Apply a full date RANGE: set start date AND grow/shrink the day count to
     match the span WITHOUT losing stops (grow appends empty days inheriting the
     last city; shrink folds trailing days' stops into the last kept day). */
  const applyDateRange = useCallback((startISO, endISO) => {
    if (!startISO) { saveStartDate(null); return; }
    const s = new Date(startISO);
    const e = endISO ? new Date(endISO) : null;
    const newCount = (s && e && e >= s) ? Math.round((e - s) / 86400000) + 1 : null;
    if (newCount && newCount >= 1) {
      /* Atomic: grow/shrink the day array AND, when shrinking, drop any general
         file whose `day` now exceeds the trip length back to כללי (day:null) —
         same commitData write as the renumber. */
      commitData((data) => {
        let next = (data.tripData || []).map((d) => ({ ...d, attractions: [...(d.attractions || [])] }));
        const cur = next.length;
        if (newCount > cur) {
          const last = next[cur - 1] || {};
          for (let i = cur; i < newCount; i++) next.push({ day: i + 1, city: last.city, cityHe: last.cityHe, attractions: [] });
        } else if (newCount < cur) {
          const keep = next.slice(0, newCount);
          const dropped = next.slice(newCount);
          const foldTarget = keep[keep.length - 1];
          dropped.forEach((d) => { foldTarget.attractions = [...foldTarget.attractions, ...(d.attractions || [])]; });
          next = keep;
        }
        const renumbered = next.map((d, i) => ({ ...d, day: i + 1 }));
        if (newCount < cur) {
          const mapping = {};
          for (let i = 1; i <= renumbered.length; i++) mapping[i] = i;
          return {
            ...data,
            tripData: renumbered,
            files: remapFileDays(data.files, mapping, renumbered.length),
            ...(data.budget ? {
              budget: { ...data.budget, items: remapExpenseDays(data.budget.items, mapping, renumbered.length) },
            } : {}),
          };
        }
        return { ...data, tripData: renumbered };
      });
    }
    saveStartDate(startISO);
  }, [commitData, saveStartDate]);

  return {
    trip, error, saving,
    days, tripFiles, activeDay, setActiveDay, activeDayData, mapStops,
    editable, commitDays, reload,
    deleteStopAt, duplicateStopAt, moveStopToDay, setStopNote, reorderInDay, setDayOrder, addStopToDay,
    addTransitToDay, updateStopAt, addAttachmentToStop, removeAttachmentAt, insertAt, addTripFile, updateTripFile, removeTripFile, renameAttachmentAt,
    addDay, deleteDay, saveStartDate, applyDateRange, moveStopToInbox, saveCustomPin, addSearchedToInbox,
    inbox, inboxLoading, loadInbox, assignInboxToDay, removeFromInbox, updateInboxNote, connectSavedPlaces,
    saveStopCost, removeStopCost, costForStop, commitData,
  };
}
