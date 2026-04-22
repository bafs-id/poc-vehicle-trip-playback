import type { LatLng } from "../types";

/** Default speed limit (km/h) used until the user changes it. */
export const DEFAULT_SPEED_THRESHOLD_KMH = 50;

/** Implausible speed cap (km/h). Anything above this is considered a GPS jump. */
export const OUTLIER_SPEED_KMH = 250;

/**
 * Out-and-back GPS spike detection. For an interior point B between
 * neighbors A and C, B is treated as a spike when
 * `haversine(A, C) / (haversine(A, B) + haversine(B, C)) < SPIKE_RETURN_RATIO`
 * (i.e. the detour to B is much longer than the direct A→C path) AND both
 * legs are at least `SPIKE_MIN_LEG_M` long.
 */
export const SPIKE_RETURN_RATIO = 0.3;
export const SPIKE_MIN_LEG_M = 80;

/** Tighter speed-based spike cap (km/h) used during cleaning. */
export const SPIKE_SPEED_KMH = 150;

/** Maximum number of cleaning passes when removing GPS spikes. */
export const MAX_SPIKE_PASSES = 3;

/** Earth radius in meters (mean), used by the Haversine formula. */
export const EARTH_RADIUS_M = 6_371_000;

/** Playback speed multipliers exposed in the UI. */
export const PLAYBACK_RATES = [1, 2, 4, 8, 16] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Default playback speed multiplier. */
export const DEFAULT_PLAYBACK_RATE: PlaybackRate = 4;

/** Map fallback center when the dataset is empty (Bangkok area). */
export const MAP_FALLBACK_CENTER: LatLng = { lat: 13.6844, lng: 100.7437 };

/** Initial zoom for the map. */
export const MAP_DEFAULT_ZOOM = 15;

/** Zoom level used when flying to a speeding event. */
export const MAP_FLY_TO_ZOOM = 17;

/** Maximum zoom used when fitting bounds. */
export const MAP_FIT_MAX_ZOOM = 17;

/** Padding (px) used when fitting bounds. */
export const MAP_FIT_PADDING: [number, number] = [40, 40];
