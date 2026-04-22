export type LatLng = {
  lat: number;
  lng: number;
};

export type RawPoint = LatLng & {
  timestamp: Date;
};

/** A processed point: speed/distance refer to the segment FROM the previous point TO this one. */
export type Point = RawPoint & {
  index: number;
  /** meters from previous point (0 for the first point) */
  distanceM: number;
  /** seconds since previous point (0 for the first point) */
  dtSec: number;
  /** km/h for the incoming segment (0 for the first point) */
  speedKmh: number;
  /** true when speedKmh > threshold AND not flagged as outlier */
  isSpeeding: boolean;
  /** speedKmh exceeded the plausibility cap; not counted as a speeding event */
  isOutlier: boolean;
};

export type Trip = {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: Date;
  endTime: Date;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  speedingCount: number;
};

export type SpeedingEvent = {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: Date;
  endTime: Date;
  peakSpeedKmh: number;
  distanceKm: number;
  midLat: number;
  midLng: number;
};

/** Discriminated state for the initial CSV load. */
export type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

/** Target for an imperative map fly-to. */
export type FlyToTarget = LatLng & { zoom?: number };

/** A vehicle discovered in public/vehicle_logs/. */
export type Vehicle = {
  /** Filename stem, e.g. "ZS-44". Used as a stable id and display label. */
  id: string;
  fileName: string;
  url: string;
};
