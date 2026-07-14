import { useEffect, useState } from "react";
import tripService, { ACTIVE_TRIP_EVENT } from "../services/tripService";

/* ──────────────────────────────────────────────────────────────
   useActiveTrip — reactive subscription to the globally "live" trip.

   Returns the active trip id (or null) and re-renders the consumer
   whenever it changes, via two channels:
     • ACTIVE_TRIP_EVENT — same-tab mutations (setActiveTrip dispatch)
     • the native `storage` event — changes from OTHER tabs

   The initial value is read synchronously so the first paint is
   already correct (no flash of the inactive state).
   ────────────────────────────────────────────────────────────── */
export const useActiveTrip = () => {
  const [activeId, setActiveId] = useState(() => tripService.getActiveTripIdSync());

  useEffect(() => {
    const sync = () => setActiveId(tripService.getActiveTripIdSync());
    const onCustom = (e) =>
      setActiveId(e?.detail ? e.detail.tripId ?? null : tripService.getActiveTripIdSync());

    window.addEventListener(ACTIVE_TRIP_EVENT, onCustom);
    window.addEventListener("storage", sync);
    /* Re-sync on mount in case the value changed before listeners
       were attached. */
    sync();
    return () => {
      window.removeEventListener(ACTIVE_TRIP_EVENT, onCustom);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return activeId;
};

export default useActiveTrip;
