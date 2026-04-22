import type { Point, RawPoint } from "../types";
import { haversineMeters } from "./geo";

/** Implausible speed cap (km/h). Anything above this is considered a GPS jump. */
const OUTLIER_SPEED_KMH = 250;

export function processPoints(raw: RawPoint[], thresholdKmh: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    if (i === 0) {
      out.push({
        ...cur,
        index: 0,
        distanceM: 0,
        dtSec: 0,
        speedKmh: 0,
        isSpeeding: false,
        isOutlier: false,
      });
      continue;
    }
    const prev = raw[i - 1];
    const dtSec = (cur.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
    const distanceM = haversineMeters(prev, cur);
    const speedKmh = dtSec > 0 ? (distanceM / dtSec) * 3.6 : 0;
    const isOutlier = speedKmh > OUTLIER_SPEED_KMH;
    out.push({
      ...cur,
      index: i,
      distanceM,
      dtSec,
      speedKmh,
      isOutlier,
      isSpeeding: !isOutlier && speedKmh > thresholdKmh,
    });
  }
  return out;
}
