import type { Point, Trip } from "../types";
import { hourKey } from "./date";

/**
 * Bucket points into "trips" by **local clock hour** (e.g. 07:00–07:59).
 * NOTE: this is a calendar-hour bucket, not a movement-based trip — long
 * dwells inside a single hour stay in the same bucket. Empty hours produce
 * no trip.
 */
export function segmentTrips(points: Point[]): Trip[] {
  if (points.length === 0) return [];

  const buckets = new Map<string, Point[]>();
  for (const p of points) {
    const key = hourKey(p.timestamp);
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(p);
  }

  return [...buckets.keys()]
    .sort()
    .map((key) => buildTrip(key, buckets.get(key)!));
}

function buildTrip(key: string, slice: Point[]): Trip {
  // Per-segment metrics on the first point of a bucket are 0 OR refer to the
  // gap from the previous bucket — we exclude index 0 of the slice so they
  // don't contaminate distance/avg-speed for this bucket.
  let distanceM = 0;
  let movingDistanceM = 0;
  let movingSec = 0;
  let maxSpeedKmh = 0;
  let speedingCount = 0;

  for (let i = 0; i < slice.length; i++) {
    const p = slice[i];
    if (p.isSpeeding) speedingCount += 1;
    if (i === 0) continue;
    distanceM += p.distanceM;
    if (p.isOutlier) continue;
    movingDistanceM += p.distanceM;
    movingSec += p.dtSec;
    if (p.speedKmh > maxSpeedKmh) maxSpeedKmh = p.speedKmh;
  }

  const avgSpeedKmh = movingSec > 0 ? (movingDistanceM / movingSec) * 3.6 : 0;
  const first = slice[0];
  const last = slice[slice.length - 1];

  return {
    id: `trip-${key}`,
    startIndex: first.index,
    endIndex: last.index,
    startTime: first.timestamp,
    endTime: last.timestamp,
    distanceKm: distanceM / 1000,
    maxSpeedKmh,
    avgSpeedKmh,
    speedingCount,
  };
}
