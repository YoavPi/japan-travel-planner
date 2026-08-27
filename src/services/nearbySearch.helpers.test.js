import { mapNearbyResult, shouldWidenNearby } from "./googlePlaces";

const fakeRaw = (over = {}) => ({
  place_id: "p1", name: "Trattoria", vicinity: "Via Roma 1",
  geometry: { location: { lat: () => 41.9, lng: () => 12.5 } },
  rating: 4.4, types: ["restaurant"], ...over,
});

test("mapNearbyResult maps a raw Google result to the search result shape", () => {
  expect(mapNearbyResult(fakeRaw())).toEqual({
    placeId: "p1", name: "Trattoria", primary: "Trattoria",
    secondary: "Via Roma 1", lat: 41.9, lng: 12.5, rating: 4.4, types: ["restaurant"],
  });
});

test("mapNearbyResult returns null when coordinates are missing", () => {
  expect(mapNearbyResult(fakeRaw({ geometry: undefined }))).toBeNull();
});

test("shouldWidenNearby is true only when fewer than 4 results", () => {
  expect(shouldWidenNearby([1, 2, 3])).toBe(true);
  expect(shouldWidenNearby([1, 2, 3, 4])).toBe(false);
});
