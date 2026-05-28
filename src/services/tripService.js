/* ══════════════════════════════════════════════════════════════
   tripService — dynamic data-layer factory.

   Decouples every component from the hardcoded tripData.js import.
   All methods are async and return Promises so the UI can show
   loading skeletons; a small artificial lag mimics real network
   latency, guaranteeing the skeleton paths are exercised. The
   persistence engine is window.localStorage with JSON
   serialization — a drop-in that can later be replaced by Supabase
   / Vercel Postgres by swapping ONLY the bodies of these methods.

   Trip record shape (matches the design blueprints' state spec):
     {
       id, title, cover, days (number), meta, role,
       owner: { id, name },
       collaborators: [{ id, name, email, role, avatar }],
       sharedBy?: string,
       lastEdited: ISO string,
       settings: { destination, dateRange, ... },
       data: {                      // the actual itinerary payload
         tripData: [...],           // per-day attractions
         cityTransitions: [...],    // inter-city legs
         lodgingOverrides: {...},
       }
     }
   ══════════════════════════════════════════════════════════════ */

import { tripData, routePath, HOTEL_COORDINATES } from "../data/tripData";
import { cityTransitions, lodgingOverrides } from "../data/transportData";

const STORAGE_KEY = "tp_trips_v2"; // bump to re-seed (Dubai now has sample stops)
const LAG = 450; // ms — simulated network latency

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const nowISO = () => new Date().toISOString();
const uid = (p = "trip") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/* ── Seed data ────────────────────────────────────────────────
   The existing hardcoded Japan itinerary becomes the first
   (read-only example) trip in the store. Two extra sample trips
   give the dashboard a realistic multi-trip grid. */
const buildJapanSeed = () => ({
  id: "japan-demo",
  title: "ירח דבש ביפן",
  cover: "/photos/source/day01_harajuku.jpg",
  days: tripData.length,
  meta: "31 ימים · 9 ערים · פברואר–מרץ 2024",
  role: "owner",
  readOnly: true, /* the canonical example — not user-editable */
  owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
  collaborators: [],
  lastEdited: "2024-04-01T10:00:00.000Z",
  settings: { destination: "Japan", destinationHe: "יפן" },
  data: {
    tripData,
    cityTransitions,
    lodgingOverrides,
    routePath,
    HOTEL_COORDINATES,
  },
});

const SAMPLE_TRIPS = [
  {
    id: "dubai-2026",
    title: "הטיול שלי לדובאי",
    cover: "/photos/source/day22_teamlab-planets.jpg",
    days: 5,
    meta: "5 ימים · דובאי · 2026",
    role: "owner",
    readOnly: false,
    owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
    collaborators: [],
    lastEdited: "2026-03-12T08:30:00.000Z",
    settings: { destination: "Dubai", destinationHe: "דובאי" },
    /* Seeded with a couple of real days so the editor's day-strip,
       stop rows, drag-reorder, and auto-transit rails have live
       content to demonstrate without the Places flow. */
    data: {
      tripData: [
        {
          day: 1, city: "Dubai", cityHe: "דובאי",
          coordinates: { lng: 55.2744, lat: 25.1972 },
          attractions: [
            { name: "Burj Khalifa", nameHe: "בורג' ח'ליפה", category: "אטרקציה", rating: "9.4/10", coordinates: { lng: 55.2744, lat: 25.1972 } },
            { name: "Dubai Mall", nameHe: "דובאי מול", category: "קניות", coordinates: { lng: 55.2796, lat: 25.1985 } },
            { name: "Dubai Fountain", nameHe: "מזרקת דובאי", category: "אטרקציה", coordinates: { lng: 55.2754, lat: 25.1956 } },
            { name: "At.mosphere", nameHe: "מסעדת אטמוספיר", category: "מסעדה", rating: "9/10", coordinates: { lng: 55.2742, lat: 25.1971 } },
          ],
        },
        {
          day: 2, city: "Dubai", cityHe: "דובאי",
          coordinates: { lng: 55.1853, lat: 25.1412 },
          attractions: [
            { name: "Palm Jumeirah", nameHe: "פאלם ג'ומיירה", category: "אטרקציה", coordinates: { lng: 55.1390, lat: 25.1124 } },
            { name: "Atlantis The Palm", nameHe: "אטלנטיס", category: "מלון", rating: "9/10", coordinates: { lng: 55.1175, lat: 25.1304 } },
          ],
        },
      ],
      cityTransitions: [],
      lodgingOverrides: {},
    },
  },
  {
    id: "paris-weekend",
    title: "סופ\"ש בפריז",
    cover: "/photos/source/day29_starbucks-reserve.jpg",
    days: 3,
    meta: "3 ימים · פריז · שותף איתך",
    role: "edit",
    readOnly: false,
    owner: { id: "u_friend", name: "יותם" },
    sharedBy: "יותם",
    collaborators: [
      { id: "u_michali", name: "מיכלי", email: "michali.pintel@gmail.com", role: "edit", avatar: null },
    ],
    lastEdited: "2026-02-20T19:15:00.000Z",
    settings: { destination: "Paris", destinationHe: "פריז" },
    data: { tripData: [], cityTransitions: [], lodgingOverrides: {} },
  },
];

/* Read the whole store, seeding on first run. */
const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  const seed = [buildJapanSeed(), ...SAMPLE_TRIPS];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
};

const writeStore = (trips) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
};

/* Lightweight list projection (omit the heavy `data` payload so
   the dashboard grid stays snappy). */
const toSummary = ({ data, ...rest }) => rest;

export const tripService = {
  /* All trips visible to a user (owned + shared-to). For the mock
     we return everything; a real backend would filter by userId. */
  async fetchAllTrips(/* userId */) {
    await delay(LAG);
    return readStore().map(toSummary);
  },

  /* Full trip incl. itinerary payload. */
  async fetchTripById(tripId) {
    await delay(LAG);
    const trip = readStore().find((t) => t.id === tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);
    return trip;
  },

  /* Persist edits to an existing trip's payload. */
  async saveTrip(tripId, patch) {
    await delay(LAG);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    if (trips[idx].readOnly) throw new Error("This trip is read-only.");
    trips[idx] = { ...trips[idx], ...patch, lastEdited: nowISO() };
    writeStore(trips);
    return trips[idx];
  },

  /* Create a blank itinerary from wizard settings. */
  async createNewTrip(tripSettings = {}) {
    await delay(LAG);
    const trips = readStore();
    const id = uid();
    const trip = {
      id,
      title: tripSettings.title || tripSettings.destinationHe || "מסלול חדש",
      cover: tripSettings.cover || null,
      days: tripSettings.days || 0,
      meta: tripSettings.meta || "",
      role: "owner",
      readOnly: false,
      owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
      collaborators: [],
      lastEdited: nowISO(),
      settings: tripSettings,
      data: { tripData: [], cityTransitions: [], lodgingOverrides: {} },
    };
    trips.unshift(trip);
    writeStore(trips);
    return trip;
  },

  /* Dev helper — wipe & re-seed (handy while iterating). */
  async resetStore() {
    localStorage.removeItem(STORAGE_KEY);
    return readStore();
  },
};

export default tripService;
