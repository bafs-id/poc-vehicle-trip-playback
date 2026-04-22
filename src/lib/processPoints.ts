import type { Point, RawPoint } from "../types";
import { OUTLIER_SPEED_KMH } from "./constants";
import { secondsBetween } from "./date";
import { haversineMeters } from "./geo";

/**
 * Enrich raw points with per-segment kinematics (distance/dt/speed/outlier)
 * and a threshold-based `isSpeeding` flag.
 */
export function processPoints(raw: RawPoint[], thresholdKmh: number): Point[] {
  const kinematic = computeKinematics(raw);
  return classifySpeeding(kinematic, thresholdKmh);
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
