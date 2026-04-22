import type { Point, Trip } from "../types";

/**
 * Bucket points into trips by clock hour (local time). Each trip covers
 * one hour, e.g. 07:00–07:59. Empty hours produce no trip.
 */
export function segmentTrips(points: Point[]): Trip[] {
  if (points.length === 0) return [];

  const trips: Trip[] = [];
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

  const keys = [...buckets.keys()].sort();
  for (const key of keys) {
    const slice = buckets.get(key)!;
    if (slice.length === 0) continue;
    const distanceM = slice.reduce(
      (s, p, i) => (i === 0 ? 0 : s + p.distanceM),
      0,
    );
    const movingSlice = slice.slice(1).filter((p) => !p.isOutlier);
    const maxSpeedKmh = movingSlice.reduce(
      (m, p) => Math.max(m, p.speedKmh),
      0,
    );
    const totalSec = movingSlice.reduce((s, p) => s + p.dtSec, 0);
    const movingDistM = movingSlice.reduce((s, p) => s + p.distanceM, 0);
    const avgSpeedKmh = totalSec > 0 ? (movingDistM / totalSec) * 3.6 : 0;
    const speedingCount = slice.filter((p) => p.isSpeeding).length;
    trips.push({
      id: `trip-${key}`,
      startIndex: slice[0].index,
      endIndex: slice[slice.length - 1].index,
      startTime: slice[0].timestamp,
      endTime: slice[slice.length - 1].timestamp,
      distanceKm: distanceM / 1000,
      maxSpeedKmh,
      avgSpeedKmh,
      speedingCount,
    });
  }

  return trips;
}

function hourKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}`;
}
