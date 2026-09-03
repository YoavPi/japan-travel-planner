import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tripService from "../services/tripService";
import {
  rollup, hasBudget, ensureBudget, setBudgetConfig, upsertCategory, removeCategory,
  addExpense, updateExpense, removeExpense, setPaid,
} from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   useBudget — one trip's budget: state, mutation, persistence.

   Every surface reads its numbers from `roll` (the rollup selector),
   so no two surfaces can disagree. Mutators apply the pure transforms
   from utils/budget.js and persist the whole `data` object through
   tripService.saveTrip — which re-derives data.budget.summary on the
   way through, so the dashboard indicator can never go stale.

   There is deliberately no tripService.saveBudget: the recompute lives
   in saveTrip, so a budget-specific method would add an API without
   adding a guarantee.

   Writes are OPTIMISTIC and roll back on failure. This is money — a
   silently dropped save would be worse than a visible error.
   ══════════════════════════════════════════════════════════════ */

export default function useBudget(trip) {
  const tripId = trip?.id || null;
  const readOnly = !!trip?.readOnly;

  const [data, setData] = useState(trip?.data || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* Re-sync when the caller hands us a different trip, or reloads the same one
     (lastEdited advances). Keyed on id + the reload signal, NEVER on `trip.data`
     object identity: a caller that rebuilds `trip` on every render (an
     unmemoized parent, a test harness) would otherwise drive an update loop —
     new object each render → effect re-fires → setData → re-render. */
  const reloadKey = trip?.lastEdited || null;
  useEffect(() => { setData(trip?.data || null); setError(null); }, [tripId, reloadKey]);

  /* The last state known to be persisted, for rollback. */
  const committed = useRef(trip?.data || null);
  useEffect(() => { committed.current = trip?.data || null; }, [tripId, reloadKey]);

  /* The live value, so two synchronous mutations compose correctly. It is
     updated eagerly rather than via an effect: the save must be kicked off
     OUTSIDE the setState updater — an updater that fires a request is a side
     effect in a reducer, and React would run it twice under StrictMode. */
  const dataRef = useRef(trip?.data || null);
  useEffect(() => { dataRef.current = trip?.data || null; }, [tripId, reloadKey]);

  const mutate = useCallback((fn) => {
    if (readOnly || !tripId) return;
    const prev = dataRef.current || {};
    const next = fn(prev);
    if (next === prev) return;

    const rollbackTo = committed.current;
    dataRef.current = next;
    setData(next);
    setSaving(true);
    setError(null);

    tripService.saveTrip(tripId, { data: next })
      .then(() => { committed.current = next; })
      .catch((e) => {
        setError(e?.message || "השמירה נכשלה");
        dataRef.current = rollbackTo;
        setData(rollbackTo);
      })
      .finally(() => setSaving(false));
  }, [readOnly, tripId]);

  const budget = data?.budget || null;
  const roll = useMemo(() => rollup(budget), [budget]);

  const setConfig = useCallback((patch) => mutate((d) => setBudgetConfig(d, patch)), [mutate]);
  const saveCategory = useCallback((cat) => mutate((d) => upsertCategory(d, cat)), [mutate]);
  const deleteCategory = useCallback((key) => mutate((d) => removeCategory(d, key)), [mutate]);
  const createExpense = useCallback((e) => mutate((d) => addExpense(ensureBudget(d), e)), [mutate]);
  const editExpense = useCallback((id, patch) => mutate((d) => updateExpense(d, id, patch)), [mutate]);
  const deleteExpense = useCallback((id) => mutate((d) => removeExpense(d, id)), [mutate]);
  const markPaid = useCallback(
    (id, paid, actualMinor = null) => mutate((d) => setPaid(d, id, paid, actualMinor)), [mutate]);

  return {
    data, budget, roll,
    hasAny: hasBudget(budget),
    readOnly, saving, error,
    setConfig, saveCategory, deleteCategory,
    createExpense, editExpense, deleteExpense, markPaid,
  };
}
