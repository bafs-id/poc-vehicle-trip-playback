# 03 — Domain pipeline

## Goal

Write the three pure functions that turn raw GPS points into the data structures the UI renders:

1. `processPoints` — clean spikes, compute kinematics, classify speeding.
2. `segmentTrips` — bucket points into per-hour trips.
3. `buildSpeedingEvents` — group consecutive over-speed points into events.

These files import only from `types.ts`, `lib/constants.ts`, `lib/geo.ts`, and `lib/date.ts` — all in place from earlier phases.

## Files to create

### `src/lib/processPoints.ts`

```ts
import type { Point, RawPoint } from "../types";
import {
  MAX_SPIKE_PASSES,
  OUTLIER_SPEED_KMH,
  SPIKE_MIN_LEG_M,
  SPIKE_RETURN_RATIO,
  SPIKE_SPEED_KMH,
} from "./constants";
import { secondsBetween } from "./date";
import { haversineMeters } from "./geo";

/**
 * Enrich raw points with per-segment kinematics (distance/dt/speed/outlier)
 * and a threshold-based `isSpeeding` flag. GPS "spikes" — points that jump
 * far away and return — are removed before kinematics are computed so the
 * polyline, trips, and speeding events don't see them.
 */
export function processPoints(raw: RawPoint[], thresholdKmh: number): Point[] {
  const cleaned = cleanRaw(raw);
  return classifySpeeding(computeKinematics(cleaned), thresholdKmh);
}

/**
 * Iteratively remove GPS-spike points from `raw`. Each pass computes
 * kinematics, flags suspect points, and drops them; repeat until no new
 * spikes are found or `MAX_SPIKE_PASSES` is reached. Iteration handles
 * adjacent / clustered spikes that only become detectable after their
 * neighbors are removed.
 */
export function cleanRaw(raw: RawPoint[]): RawPoint[] {
  let current = raw;
  for (let pass = 0; pass < MAX_SPIKE_PASSES; pass++) {
    const kin = computeKinematics(current);
    const spikes = detectSpikeIndices(kin);
    if (spikes.size === 0) return current;
    const next = current.filter((_, i) => !spikes.has(i));
    // Refuse to empty the dataset — bail out if cleaning would drop everything.
    if (next.length < 2) return current;
    current = next;
  }
  return current;
}

/** Threshold-independent enrichment: distance/dt/speed/outlier per point. */
export function computeKinematics(raw: RawPoint[]): Point[] {
  if (raw.length === 0) return [];

  const out: Point[] = new Array(raw.length);
  out[0] = {
    ...raw[0],
    index: 0,
    distanceM: 0,
    dtSec: 0,
    speedKmh: 0,
    isSpeeding: false,
    isOutlier: false,
  };

  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1];
    const cur = raw[i];
    const dtSec = secondsBetween(prev.timestamp, cur.timestamp);
    const distanceM = haversineMeters(prev, cur);
    const speedKmh = dtSec > 0 ? (distanceM / dtSec) * 3.6 : 0;
    out[i] = {
      ...cur,
      index: i,
      distanceM,
      dtSec,
      speedKmh,
      isOutlier: speedKmh > OUTLIER_SPEED_KMH,
      isSpeeding: false, // assigned by classifySpeeding
    };
  }
  return out;
}

/**
 * Identify GPS-spike point indices. A point B is a spike when either:
 *   - geometric out-and-back: with neighbors A and C,
 *     `d(A,C) / (d(A,B) + d(B,C)) < SPIKE_RETURN_RATIO` and both legs
 *     are at least `SPIKE_MIN_LEG_M`; or
 *   - the incoming segment speed exceeds `SPIKE_SPEED_KMH`.
 * Endpoints are flagged only by the speed criterion.
 */
export function detectSpikeIndices(points: Point[]): Set<number> {
  const spikes = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    if (points[i].speedKmh > SPIKE_SPEED_KMH) spikes.add(i);
  }
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const ab = haversineMeters(a, b);
    const bc = haversineMeters(b, c);
    if (ab < SPIKE_MIN_LEG_M || bc < SPIKE_MIN_LEG_M) continue;
    const ac = haversineMeters(a, c);
    const ratio = ac / (ab + bc);
    if (ratio < SPIKE_RETURN_RATIO) spikes.add(i);
  }
  return spikes;
}

/**
 * Mark each point as speeding when its incoming speed exceeds `thresholdKmh`
 * and is not an outlier. Returns a new array; input is not mutated.
 */
export function classifySpeeding(
  points: Point[],
  thresholdKmh: number,
): Point[] {
  return points.map((p) => ({
    ...p,
    isSpeeding: !p.isOutlier && p.speedKmh > thresholdKmh,
  }));
}
```

#### Walk-through (in build order)

1. **`computeKinematics`** — the inner loop assigns `(distanceM, dtSec, speedKmh)` to point `i` based on the segment from `i-1` to `i`. Index 0 is zeroed because there is no "previous" segment. `speedKmh = (distanceM / dtSec) * 3.6` (m/s → km/h; only when `dtSec > 0` to avoid division by zero on duplicate timestamps).

2. **`detectSpikeIndices`** — the geometric idea, with an ASCII picture:

   ```
       B  (spike)
      /\
     /  \
    A----C   d(A,C) is much shorter than d(A,B) + d(B,C)
   ```

   When the direct A→C distance is a small fraction of the detour through B, B is almost certainly a GPS jump. We require both legs ≥ 80 m so we don't flag legitimate hairpins or two-point neighborhoods.

   The first loop adds anything whose **incoming speed** exceeds 150 km/h — catches isolated jumps at the dataset edges where the geometric test can't fire.

3. **`cleanRaw`** — _why a loop?_ Two adjacent spikes hide each other:

   ```
   A — B' — B'' — C       both B' and B'' are spikes,
                          but the geometric test on B' uses B'' as its right neighbor,
                          so the "out-and-back" doesn't close.
   ```

   Removing B' on pass 1 makes B'' visible as a spike on pass 2. Three passes is the cap; if cleaning would empty the dataset, we keep the previous version (better noisy data than no data).

4. **`classifySpeeding`** — returns a new array (immutable). `isSpeeding` is **suppressed for outliers** so a 999 km/h GPS jump never appears as "the driver was speeding".

5. **`processPoints`** — orchestrator: `cleanRaw` → `computeKinematics` → `classifySpeeding`.

### `src/lib/segmentTrips.ts`

```ts
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
```

#### Walk-through

- **Trip = local-hour bucket.** Cheap, deterministic, no hyperparameters. Long stops inside the same hour stay in one trip — that's a known limitation, not a bug.
- **Why skip index 0 of the slice?** That point's `distanceM`/`dtSec` describe the gap from the _previous bucket's last point_. Including it would charge this trip with the previous trip's drive-home, inflating distance and average speed.
- **`avgSpeedKmh` excludes outliers** — both the `if (p.isOutlier) continue` and the moving-time accumulator. So a five-hour stationary period followed by one valid 60 km/h sample still averages to 60 km/h, not 12.
- **Stable id** `trip-<hourKey>` — the same trip across recomputes (e.g. user changes the threshold) keeps the same id, so the user's "selected trip" survives.

### `src/lib/speedingEvents.ts`

```ts
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
```

#### Walk-through

- **The `gap` tolerance.** Real GPS data flickers — one sample below 50 km/h between dozens above is noise, not the end of a speeding event. `MAX_GAP_POINTS = 1` papers over that.
- **`lastSpeeding`** tracks the _trailing edge of true speeding_, so when we emit an event, any tolerated non-speeding tail is **trimmed off**. The event's end is a real over-speed point.
- **Stable id** `evt-<startIndex>-<endIndex>` — survives threshold changes for the same reason trip ids do.

## Pitfalls

> **Don't divide by `dtSec` for index 0.** It's zeroed; the guard inside `computeKinematics` handles this. Any downstream code that does its own derivation must guard the same way.

> **`detectSpikeIndices` returns a `Set<number>`** — when you delete those indices in `cleanRaw`, the _remaining_ points get fresh consecutive indices via `computeKinematics` next pass. So `Point.index` always refers to position in the **post-cleaning** array, not the original CSV row.

> **`speedingCount` in `buildTrip` counts every `isSpeeding` point, including index 0** — but `isSpeeding` is always `false` for index 0 of `allPoints` (because `speedKmh = 0` there). For trips that don't start at the dataset's index 0, the bucket's first point can in principle be `isSpeeding`. This is intentional: the count reflects the number of speeding samples inside the bucket, not the number of distinct events.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean.

Optional smoke test — paste into `src/scratch.ts`:

```ts
import { processPoints } from "./lib/processPoints";
import { segmentTrips } from "./lib/segmentTrips";
import { buildSpeedingEvents } from "./lib/speedingEvents";

const start = new Date("2026-04-22T07:00:00+07:00").getTime();
const raw = Array.from({ length: 100 }, (_, i) => ({
  // ~7 m/s east-northeast
  lat: 13.7 + i * 0.00005,
  lng: 100.7 + i * 0.00005,
  timestamp: new Date(start + i * 5000),
}));
const points = processPoints(raw, 50);
console.log("points:", points.length);
console.log(
  "max speed:",
  Math.max(...points.map((p) => p.speedKmh)).toFixed(1),
);
console.log(
  "trips:",
  segmentTrips(points).map((t) => t.id),
);
console.log("events:", buildSpeedingEvents(points).length);
```

Run with `npx tsx src/scratch.ts`. You should see ~100 points, a constant ~28 km/h, one trip, and zero events. Bump the lat/lng deltas tenfold to push speeds past the threshold and watch events appear. Delete `scratch.ts` afterwards.

➡️ Continue to [04-data-loading.md](04-data-loading.md).
