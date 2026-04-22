export type RawPoint = {
  lat: number;
  lng: number;
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

export type LoadStatus = "idle" | "loading" | "ready" | "error";
