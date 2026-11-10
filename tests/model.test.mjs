import test from "node:test";
import assert from "node:assert/strict";
import { cityPoints, distanceKm, nearbyCity } from "../src/locations.ts";
import { score, sortRides } from "../src/model.ts";
test("pickup coordinates resolve to supported cities without inventing a city abroad", () => {
  for (const [city, point] of Object.entries(cityPoints))
    assert.equal(nearbyCity(point), city);
  assert.equal(nearbyCity({ latitude: 51.5, longitude: 0 }), null);
  assert.equal(nearbyCity({ latitude: NaN, longitude: 33 }), null);
  assert.ok(distanceKm(cityPoints.Nicosia, cityPoints.Limassol) > 50);
});
const rides = [
  {
    id: "a",
    driver_id: "a",
    departure: "2027-01-01T10:00:00Z",
    duration: 60,
    price: 8,
  },
  {
    id: "b",
    driver_id: "b",
    departure: "2027-01-01T09:00:00Z",
    duration: 90,
    price: 5,
  },
  {
    id: "c",
    driver_id: "c",
    departure: "2027-01-01T11:00:00Z",
    duration: 45,
    price: 10,
  },
];
const reviews = [
  { driver_id: "a", rating: 5, driving: 4, chatty: 2 },
  { driver_id: "b", rating: 3, driving: 5, chatty: 5 },
];
test("departure, duration and cost sort numerically and preserve source data", () => {
  assert.deepEqual(
    sortRides(rides, reviews, "Departure").map((r) => r.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sortRides(rides, reviews, "Journey time").map((r) => r.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    sortRides(rides, reviews, "Cost / seat").map((r) => r.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    rides.map((r) => r.id),
    ["a", "b", "c"],
  );
});
test("review-based sorts put unrated drivers last including quiet preference", () => {
  for (const [sort, ids] of [
    ["Rating", ["a", "b", "c"]],
    ["Driving quality", ["b", "a", "c"]],
    ["Chatty", ["b", "a", "c"]],
    ["Quiet", ["a", "b", "c"]],
  ])
    assert.deepEqual(
      sortRides(rides, reviews, sort).map((r) => r.id),
      ids,
    );
  assert.equal(score(reviews, "c", "rating"), null);
  assert.equal(
    score([...reviews, { driver_id: "a", rating: 3 }], "a", "rating"),
    4,
  );
});
