import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import tripService from "../services/tripService";
import useBudget from "../hooks/useBudget";
import { useDarkMode } from "../utils/theme";
import { BASE_CATEGORIES, formatMoney, resolveDay } from "../utils/budget";
import Money from "../components/Money";
import BudgetSetupSheet from "../components/BudgetSetupSheet";
import ExpenseSheet from "../components/ExpenseSheet";
import ExpenseRow from "../components/ExpenseRow";

/* ══════════════════════════════════════════════════════════════
   BudgetView — /trip/budget/:tripId

   One responsive screen rather than a mobile/desktop pair: this is a
   summary block above a grouped list, which a max-width container
   handles correctly at every width. Split it only if the layouts ever
   genuinely diverge.

   Grouping defaults to CATEGORY because that is where the caps live;
   "by day" is the secondary view.

   Note App.jsx SHOW_CHROME does not match /trip/, so this route owns
   the full viewport — same as /trip/overview/:tripId.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

export default function BudgetView() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { P } = useDarkMode();

  const [trip, setTrip] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("category");     // "category" | "day"
  const [setupOpen, setSetupOpen] = useState(false);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = add, obj = edit

  useEffect(() => {
    let live = true;
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) setTrip(t); })
      .catch(() => { if (live) setLoadError("לא ניתן לטעון את התקציב"); });
    return () => { live = false; };
  }, [tripId]);

  const {
    budget, roll, hasAny, readOnly, error,
    setConfig, createExpense, editExpense, deleteExpense, markPaid,
  } = useBudget(trip);

  const config = budget?.config || { currency: "ILS", rate: 1, categories: [] };
  const items = useMemo(() => budget?.items || [], [budget]);
  const tripData = useMemo(() => trip?.data?.tripData || [], [trip]);
  const dayCount = tripData.length || trip?.days || 0;

  /* Declared categories win their label; base ones fill the rest. */
  const categories = useMemo(() => {
    const declared = config.categories || [];
    const extra = declared.filter((c) => !BASE_CATEGORIES.some((b) => b.key === c.key));
    return [...BASE_CATEGORIES, ...extra];
  }, [config.categories]);

  const labelForCategory = useCallback((key) =>
    categories.find((c) => c.key === key)?.label || "אחר", [categories]);

  const labelForDay = useCallback((item) => {
    const d = resolveDay(item, tripData);
    return d == null ? "כללי" : `יום ${d}`;
  }, [tripData]);

  const groups = useMemo(() => {
    if (mode === "category") {
      return roll.byCategory.map((c) => ({
        key: c.key,
        title: c.label,
        cap: c,
        items: items.filter((i) => (i.category || "other") === c.key),
      }));
    }
    const byDay = new Map();
    const general = [];
    for (const it of items) {
      const d = resolveDay(it, tripData);
      if (d == null) general.push(it);
      else { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(it); }
    }
    return [
      { key: "general", title: "כללי", cap: null, items: general },
      ...[...byDay.keys()].sort((a, b) => a - b)
        .map((d) => ({ key: `day-${d}`, title: `יום ${d}`, cap: null, items: byDay.get(d) })),
    ].filter((g) => g.items.length);
  }, [mode, roll.byCategory, items, tripData]);

  const submitExpense = (payload) => {
    if (editing) editExpense(editing.id, payload);
    else createExpense(payload);
    setEditing(undefined);
  };

  const page = {
    minHeight: "100vh", background: P.page, color: P.ink,
    font: `400 14.5px ${FONT}`, paddingBlockEnd: 96,
  };
  const shell = { width: "min(760px, 100%)", marginInline: "auto", padding: 16, boxSizing: "border-box" };
  const card = { background: P.panel, borderRadius: 20, padding: 18, border: `1px solid ${P.line}` };

  if (loadError) {
    return (
      <div dir="rtl" style={page}>
        <div style={shell}>
          <p role="alert" style={{ font: `700 15px ${FONT}`, color: P.danger }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div dir="rtl" style={page}>
        <div style={shell}><p style={{ color: P.ink3 }}>טוען…</p></div>
      </div>
    );
  }

  const over = roll.overBudget;

  return (
    <div dir="rtl" style={page}>
      <div style={shell}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 16 }}>
          <button
            type="button"
            aria-label="חזרה"
            onClick={() => navigate(`/trip/overview/${tripId}`)}
            style={{ minWidth: 44, minHeight: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                     background: P.panel, color: P.ink, font: `800 17px ${FONT}`, cursor: "pointer" }}
          >
            ›
          </button>
          <h1 style={{ font: `800 20px ${FONT}`, letterSpacing: "-0.014em", margin: 0 }}>
            {`תקציב · ${trip.title}`}
          </h1>
        </header>

        {error && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockEnd: 10 }}>
            {error}
          </p>
        )}

        {!hasAny ? (
          <div style={{ ...card, textAlign: "center" }}>
            <p style={{ font: `800 16px ${FONT}`, margin: "0 0 6px" }}>עוד לא הגדרת תקציב לטיול</p>
            <p style={{ font: `400 13.5px ${FONT}`, color: P.ink3, margin: "0 0 16px" }}>
              קובעים סכום, ומכאן כל הוצאה נספרת מולו.
            </p>
            {!readOnly && (
              <button type="button" onClick={() => setSetupOpen(true)}
                      style={{ minHeight: 48, padding: "0 24px", borderRadius: 999, border: "none",
                               background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
                הגדרת תקציב
              </button>
            )}
          </div>
        ) : (
          <>
            <section style={{ ...card, marginBlockEnd: 14 }}>
              <p style={{ margin: 0, font: `400 13px ${FONT}`, color: P.ink3 }}>
                <span data-testid="summary-effective">
                  <Money minor={roll.effectiveIlsMinor} currency="ILS" bold P={P}
                         tone={over ? "danger" : "ink"} style={{ fontSize: 26 }} />
                </span>
                {" מתוך "}
                <span data-testid="summary-total">
                  <Money minor={roll.totalIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
              </p>

              <div
                role="progressbar"
                aria-label="ניצול התקציב"
                aria-valuemin={0}
                aria-valuemax={roll.totalIlsMinor}
                aria-valuenow={roll.effectiveIlsMinor}
                style={{ height: 10, borderRadius: 999, background: P.surface2,
                         overflow: "hidden", marginBlock: 12 }}
              >
                <div style={{
                  height: "100%", width: `${Math.min(100, roll.pct ?? 0)}%`,
                  background: over ? P.danger : P.accent, borderRadius: 999,
                }} />
              </div>

              {/* State in WORDS — never colour alone (WCAG 2.2 AA). */}
              <p data-testid="summary-state"
                 style={{ margin: 0, font: `800 14px ${FONT}`, color: over ? P.danger : P.ink2 }}>
                {over
                  ? `חריגה של ${formatMoney(-roll.remainingIlsMinor, "ILS")}`
                  : `נותרו ${formatMoney(roll.remainingIlsMinor, "ILS")}`}
              </p>

              <p style={{ marginBlock: "10px 0", font: `600 12.5px ${FONT}`, color: P.ink3 }}>
                {"מתוכנן "}
                <span data-testid="summary-planned">
                  <Money minor={roll.plannedIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
                {" · בפועל "}
                <span data-testid="summary-actual">
                  <Money minor={roll.actualIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
              </p>
              <p data-testid="allocation"
                 style={{ marginBlock: "4px 0", font: `600 12.5px ${FONT}`, color: P.ink3 }}>
                {`הוקצה ${formatMoney(roll.allocatedIlsMinor, "ILS")} · לא מוקצה ${formatMoney(roll.unallocatedIlsMinor, "ILS")}`}
              </p>

              {!readOnly && (
                <button type="button" onClick={() => setSetupOpen(true)}
                        style={{ marginBlockStart: 14, minHeight: 44, padding: "0 18px", borderRadius: 999,
                                 border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                                 font: `700 14px ${FONT}`, cursor: "pointer" }}>
                  עריכת התקציב
                </button>
              )}
            </section>

            <div role="group" aria-label="אופן הקיבוץ"
                 style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
              {[["category", "לפי קטגוריה"], ["day", "לפי יום"]].map(([m, t]) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                        style={{ minHeight: 44, padding: "0 16px", borderRadius: 999, cursor: "pointer",
                                 border: `1px solid ${mode === m ? P.accent : P.line}`,
                                 background: mode === m ? P.accent : "transparent",
                                 color: mode === m ? "#fff" : P.ink2, font: `700 13.5px ${FONT}` }}>
                  {t}
                </button>
              ))}
            </div>

            {groups.map((g) => (
              <section key={g.key} style={{ ...card, marginBlockEnd: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBlockEnd: 8 }}>
                  <h3 style={{ font: `800 14.5px ${FONT}`, margin: 0, flex: 1 }}>{g.title}</h3>
                  {g.cap && (
                    <span style={{ font: `600 12.5px ${FONT}`, color: g.cap.over ? P.danger : P.ink3 }}>
                      <Money minor={g.cap.effectiveIlsMinor} currency="ILS" P={P}
                             tone={g.cap.over ? "danger" : "ink3"} />
                      {g.cap.capIlsMinor != null && (
                        <>
                          {" / "}
                          <Money minor={g.cap.capIlsMinor} currency="ILS" P={P} tone="ink3" />
                        </>
                      )}
                      {g.cap.over && <strong style={{ marginInlineStart: 6 }}>חריגה</strong>}
                    </span>
                  )}
                </div>
                {g.items.length === 0
                  ? <p style={{ font: `400 13px ${FONT}`, color: P.ink4, margin: 0 }}>אין הוצאות</p>
                  : g.items.map((it) => (
                      <ExpenseRow
                        key={it.id}
                        item={it}
                        config={config}
                        dayLabel={labelForDay(it)}
                        categoryLabel={labelForCategory(it.category)}
                        readOnly={readOnly}
                        P={P}
                        onEdit={setEditing}
                        onMarkPaid={markPaid}
                      />
                    ))}
              </section>
            ))}

            {!readOnly && (
              <button type="button" onClick={() => setEditing(null)}
                      style={{ width: "100%", minHeight: 52, borderRadius: 999, border: "none",
                               background: P.accent, color: "#fff", font: `800 15px ${FONT}`,
                               cursor: "pointer", marginBlockStart: 6 }}>
                הוספת הוצאה
              </button>
            )}
          </>
        )}
      </div>

      <BudgetSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        config={config}
        P={P}
        onSave={(next) => { setConfig(next); setSetupOpen(false); }}
      />

      <ExpenseSheet
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        expense={editing || null}
        config={config}
        categories={categories}
        dayCount={dayCount}
        P={P}
        onSubmit={submitExpense}
        onDelete={(id) => { deleteExpense(id); setEditing(undefined); }}
      />
    </div>
  );
}
