/* Sprint 66 — the collaborator list moved OFF the trips row into the
   per-recipient `trip_shares` table so a recipient can never read another
   recipient's email. These tests exercise the localStorage engine (no
   Supabase session in tests) — the same path demo/mock sessions use — plus
   the row-mapping guarantees that hold for both engines. */
import tripService, { rowToTrip } from "./tripService";

beforeEach(async () => {
  localStorage.clear();
  await tripService.resetStore();
});

test("rowToTrip never surfaces `collaborators` from the trips row", () => {
  const trip = rowToTrip({
    id: "t1", title: "t", owner_id: "u1",
    collaborators: [{ id: "x", email: "leak@example.com", role: "view" }],
    data: { tripData: [] },
  });
  expect(trip.collaborators).toBeUndefined();
});

test("addShare / listShares round-trip a person by email", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });

  const rec = await tripService.addShare(trip.id, "Dana@Example.com ", "view");
  expect(rec.email).toBe("dana@example.com"); // normalised: trimmed + lowercased
  expect(rec.role).toBe("view");
  expect(rec.name).toBe("dana");

  const list = await tripService.listShares(trip.id);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ email: "dana@example.com", role: "view" });
});

test("addShare is idempotent on (trip, email) — re-adding re-roles, never duplicates", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  await tripService.addShare(trip.id, "sam@example.com", "view");
  await tripService.addShare(trip.id, "sam@example.com", "edit");

  const list = await tripService.listShares(trip.id);
  expect(list).toHaveLength(1);
  expect(list[0].role).toBe("edit");
});

test("updateShareRole changes access; removeShare revokes it", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const rec = await tripService.addShare(trip.id, "lee@example.com", "view");

  await tripService.updateShareRole(trip.id, rec.id, "edit");
  expect((await tripService.listShares(trip.id))[0].role).toBe("edit");

  await tripService.removeShare(trip.id, rec.id);
  expect(await tripService.listShares(trip.id)).toHaveLength(0);
});

/* NOTE: the per-recipient privacy guarantee (a recipient's map payload never
   carries another recipient's email) is enforced on the SUPABASE path —
   `rowToTrip` drops the column and `tripPatchToRow` won't write it, so the
   `trip_shares` table (owner-only + admin RLS) is the sole store. The
   localStorage engine here still keeps a private per-browser `collaborators`
   array, which is fine — it never leaves the device. The Supabase-path
   guarantee is covered by the rowToTrip test above and by
   scripts/critical-checks.js. */
