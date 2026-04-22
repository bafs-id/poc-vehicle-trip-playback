import type { Point, SpeedingEvent } from "../types";

/** Tolerate this many consecutive non-speeding points inside a run. */
const MAX_GAP_POINTS = 1;

/**
 * Group consecutive `isSpeeding` points into events. A single non-speeding
 * point inside a run is tolerated so a brief dip below the threshold doesn't
 * split one logical event in two. Trailing non-speeding points are trimmed.
 */
export function buildSpeedingEvents(points: Point[]): SpeedingEvent[] {
  const events: SpeedingEvent[] = [];

  let runStart = -1;
  let lastSpeeding = -1;
  let gap = 0;

  const flush = () => {
    if (runStart < 0 || lastSpeeding < runStart) return;
    events.push(buildEvent(points, runStart, lastSpeeding));
    runStart = -1;
    lastSpeeding = -1;
    gap = 0;
  };

  for (let i = 0; i < points.length; i++) {
    const speeding = points[i].isSpeeding;
    if (speeding) {
      if (runStart < 0) runStart = i;
      lastSpeeding = i;
      gap = 0;
      continue;
    }
    if (runStart < 0) continue;
    gap += 1;
    if (gap > MAX_GAP_POINTS) flush();
  }
  flush();

  return events;
}

function buildEvent(
  points: Point[],
  start: number,
  end: number,
): SpeedingEvent {
  const slice = points.slice(start, end + 1);
  let peakSpeedKmh = 0;
  let distanceM = 0;
  for (const p of slice) {
    if (p.speedKmh > peakSpeedKmh) peakSpeedKmh = p.speedKmh;
    distanceM += p.distanceM;
  }
  const mid = slice[Math.floor(slice.length / 2)];
  const first = slice[0];
  const last = slice[slice.length - 1];

  // Stable IDs derived from indices so a recompute (e.g. threshold change)
  // can still match the previously-selected event.
  return {
    id: `evt-${first.index}-${last.index}`,
    startIndex: first.index,
    endIndex: last.index,
    startTime: first.timestamp,
    endTime: last.timestamp,
    peakSpeedKmh,
    distanceKm: distanceM / 1000,
    midLat: mid.lat,
    midLng: mid.lng,
  };
}
