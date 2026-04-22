import type { Point, SpeedingEvent } from "../types";

/**
 * Group consecutive `isSpeeding` points into events. Allows a small gap
 * (1 point) below the threshold to merge brief dips so events feel coherent.
 */
export function buildSpeedingEvents(points: Point[]): SpeedingEvent[] {
  const events: SpeedingEvent[] = [];
  let i = 0;
  while (i < points.length) {
    if (!points[i].isSpeeding) {
      i++;
      continue;
    }
    const start = i;
    let end = i;
    let gap = 0;
    while (end + 1 < points.length && gap <= 1) {
      const next = points[end + 1];
      if (next.isSpeeding) {
        end += 1;
        gap = 0;
      } else {
        gap += 1;
        end += 1;
      }
    }
    // trim trailing non-speeding tail
    while (end > start && !points[end].isSpeeding) end -= 1;

    const slice = points.slice(start, end + 1);
    const peakSpeedKmh = slice.reduce((m, p) => Math.max(m, p.speedKmh), 0);
    const distanceKm = slice.reduce((s, p) => s + p.distanceM, 0) / 1000;
    const mid = slice[Math.floor(slice.length / 2)];
    events.push({
      id: `evt-${events.length + 1}`,
      startIndex: slice[0].index,
      endIndex: slice[slice.length - 1].index,
      startTime: slice[0].timestamp,
      endTime: slice[slice.length - 1].timestamp,
      peakSpeedKmh,
      distanceKm,
      midLat: mid.lat,
      midLng: mid.lng,
    });
    i = end + 1;
  }
  return events;
}
