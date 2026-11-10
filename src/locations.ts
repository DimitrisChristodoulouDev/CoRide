export type Point = { latitude: number; longitude: number };
export type Pickup = Point & { address: string; city: string };
export const cityPoints: Record<string, Point> = {
  Nicosia: { latitude: 35.1856, longitude: 33.3823 },
  Limassol: { latitude: 34.6786, longitude: 33.0413 },
  Larnaca: { latitude: 34.9182, longitude: 33.6232 },
  Paphos: { latitude: 34.7754, longitude: 32.4218 },
  "Ayia Napa": { latitude: 34.9888, longitude: 34.0018 },
};
export function distanceKm(a: Point, b: Point) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function nearbyCity(point: Point): string | null {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))
    return null;
  const [name, location] = Object.entries(cityPoints).sort(
    (a, b) => distanceKm(point, a[1]) - distanceKm(point, b[1]),
  )[0];
  return distanceKm(point, location) <= 40 ? name : null;
}
