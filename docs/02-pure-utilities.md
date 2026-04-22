# 02 — Pure utilities (`src/lib/`)

## Goal

Create the small, dependency-free helpers that the domain pipeline and components both use. None of these files import from React, Zustand, or Leaflet — they're pure TypeScript.

## Files to create

### `src/lib/clsx.ts`

Tiny class-name joiner. Lets components write `clsx("tab", isActive && "active")` and get `"tab active"` or `"tab"`.

```ts
type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner: keeps truthy strings and joins with a space. */
export function clsx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
```

### `src/lib/constants.ts`

Every tunable knob. Centralizing them here makes the "magic numbers" obvious and tweakable.

```ts
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
```

| Constant                                | Why it exists                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEFAULT_SPEED_THRESHOLD_KMH`           | Initial value of the user-editable speed limit.                                                                                                                 |
| `OUTLIER_SPEED_KMH`                     | Anything faster than 250 km/h almost certainly isn't a real vehicle moving — it's a GPS jump. Outliers contribute to neither speeding events nor trip averages. |
| `SPIKE_RETURN_RATIO`, `SPIKE_MIN_LEG_M` | Geometric "out-and-back" spike test. See `processPoints.ts` walk-through next phase.                                                                            |
| `SPIKE_SPEED_KMH`                       | Stricter than `OUTLIER_SPEED_KMH`: used during the **cleaning** pass to drop spikes before kinematics are recomputed.                                           |
| `MAX_SPIKE_PASSES`                      | Spikes can be clustered; one pass might not be enough. Three passes is usually plenty.                                                                          |
| `EARTH_RADIUS_M`                        | Mean Earth radius used by Haversine. Lives in `constants.ts`, not `geo.ts`, so the radius is one place to edit.                                                 |
| `PLAYBACK_RATES`                        | The fixed `as const` tuple lets `PlaybackRate` be a precise literal union type, not just `number`.                                                              |
| `MAP_*`                                 | Map defaults — fallback center if the CSV loads empty, default zoom, fly-to/fit-bounds tuning.                                                                  |

### `src/lib/date.ts`

Local-time date helpers. The "local" part matters — we want trips bucketed by the **wall-clock hour the driver experienced**, not UTC.

```ts
/** Format a Date as a local-time YYYY-MM-DD string. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as a local-time YYYY-MM-DDTHH key (used to bucket by hour). */
export function hourKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  return `${toLocalDateString(d)}T${h}`;
}

/** Seconds elapsed from `from` to `to`. */
export function secondsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 1000;
}
```

### `src/lib/format.ts`

Display formatters. Keeps locale-aware formatting out of the components.

```ts
/** HH:MM:SS in the user's locale. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Locale date+time, used in map popups. */
export function formatDateTime(d: Date): string {
  return d.toLocaleString();
}

/** Duration in whole seconds (always at least 1s for non-zero spans). */
export function formatDurationSeconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

/** Speeding-event distance: meters when < 1 km, otherwise km with 2 decimals. */
export function formatEventDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `${(distanceKm * 1000).toFixed(0)} m`
    : `${distanceKm.toFixed(2)} km`;
}
```

### `src/lib/geo.ts`

Great-circle distance between two GPS points.

```ts
import type { LatLng } from "../types";
import { EARTH_RADIUS_M } from "./constants";

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two lat/lng points. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

## Walk-through

- **Haversine formula recap.** Given two lat/lng pairs, treat the Earth as a sphere of radius $R$. With $\Delta\phi = \phi_2 - \phi_1$ and $\Delta\lambda = \lambda_2 - \lambda_1$ in radians:

  $$h = \sin^2\!\left(\tfrac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\!\left(\tfrac{\Delta\lambda}{2}\right), \quad d = 2R \cdot \arcsin\!\bigl(\min(1, \sqrt{h})\bigr).$$

  The `min(1, …)` clamp protects against floating-point overflow when the two points are essentially identical (`sqrt(h)` may slip just over 1).

- **`hourKey` uses local time on purpose.** A driver's "07:00 trip" must stay in the 07:00 bucket regardless of UTC. If you change `hourKey` to use `getUTCHours()`, your trips will appear shifted by your timezone offset.

- **`formatDurationSeconds` clamps to ≥1s** so a sub-second event still renders as `"1s"` instead of `"0s"`. Cosmetic, but more honest.

## Pitfalls

> **Don't `import { EARTH_RADIUS_M } from "../lib/constants"` here.** You're inside `src/lib/`, so the relative import is `./constants`. Easy to get wrong if you copy-paste from a component file.

> **`PLAYBACK_RATES = [1, 2, 4, 8, 16] as const`** — the `as const` is load-bearing. Without it, `PlaybackRate` would just be `number` and the `<rate>` buttons wouldn't have type-safe click handlers.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean.

Optional smoke test — create a throwaway `src/scratch.ts`, paste:

```ts
import { haversineMeters } from "./lib/geo";
import { hourKey } from "./lib/date";
console.log(
  haversineMeters(
    { lat: 13.6844, lng: 100.7437 },
    { lat: 13.7563, lng: 100.5018 },
  ),
); // ~26000 meters Bangkok-area
console.log(hourKey(new Date("2026-04-22T07:34:00Z")));
```

…then `npx tsx src/scratch.ts` (install `tsx` globally if needed) and verify the distance is in the tens of thousands of meters. Delete `scratch.ts` when done — `tsconfig` enforces no unused files.

➡️ Continue to [03-domain-pipeline.md](03-domain-pipeline.md).
