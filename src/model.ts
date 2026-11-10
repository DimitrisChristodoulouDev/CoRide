import type { Pickup } from "./locations";
export type Review = {
  id: string;
  driver_id: string;
  author_id: string;
  booking_id: string;
  rating: number;
  driving: number;
  chatty: number;
  comment: string;
};
export type Driver = {
  id: string;
  name: string;
  avatar_url?: string | null;
  vehicle?: string;
  verification_status?: string;
  role?: string;
  driver_approved?: boolean;
  wants_driver?: boolean;
};
export type Ride = {
  id: string;
  driver_id: string;
  from_city: string;
  to_city: string;
  pickup: Pickup;
  dropoff: Pickup;
  departure: string;
  duration: number;
  price: number;
  seats: number;
  status: "scheduled" | "active" | "completed" | "cancelled";
};
export type Booking = {
  id: string;
  ride_id: string;
  passenger_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "completed";
};
export type Sort =
  | "Departure"
  | "Journey time"
  | "Rating"
  | "Cost / seat"
  | "Driving quality"
  | "Chatty"
  | "Quiet";
export const sorts: Sort[] = [
  "Departure",
  "Journey time",
  "Rating",
  "Cost / seat",
  "Driving quality",
  "Chatty",
  "Quiet",
];
export function score(
  reviews: Review[],
  driver: string,
  field: "rating" | "driving" | "chatty",
) {
  const list = reviews.filter((r) => r.driver_id === driver);
  return list.length
    ? list.reduce((sum, r) => sum + r[field], 0) / list.length
    : null;
}
export function sortRides(rides: Ride[], reviews: Review[], sort: Sort) {
  const list = [...rides];
  return list.sort((a, b) => {
    if (sort === "Departure")
      return Date.parse(a.departure) - Date.parse(b.departure);
    if (sort === "Journey time") return a.duration - b.duration;
    if (sort === "Cost / seat") return a.price - b.price;
    const field =
      sort === "Rating"
        ? "rating"
        : sort === "Driving quality"
          ? "driving"
          : "chatty";
    const av = score(reviews, a.driver_id, field),
      bv = score(reviews, b.driver_id, field);
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return sort === "Quiet" ? av - bv : bv - av;
  });
}
