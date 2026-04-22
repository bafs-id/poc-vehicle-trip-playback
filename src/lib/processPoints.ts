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
