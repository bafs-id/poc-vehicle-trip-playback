# 06 — Zustand store + selectors

## Goal

Centralize **all** application state — loaded data, filters, playback, selection, and "tell the map to do something" tokens — in one Zustand store, plus thin reusable selector hooks.

This is the largest single file in the project. Build it section by section; each piece lands in the same file.

## File 1: `src/store/useRouteStore.ts`

### 1. Imports & state shape

```ts
import { create } from "zustand";
import type {
  FlyToTarget,
  LoadState,
  Point,
  RawPoint,
  SpeedingEvent,
  Trip,
} from "../types";
import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SPEED_THRESHOLD_KMH,
  MAP_FLY_TO_ZOOM,
  type PlaybackRate,
} from "../lib/constants";
import { toLocalDateString } from "../lib/date";
import { loadVehicleCsv } from "../lib/loadCsv";
import { processPoints } from "../lib/processPoints";
import { segmentTrips } from "../lib/segmentTrips";
import { buildSpeedingEvents } from "../lib/speedingEvents";

export type RouteState = {
  loadState: LoadState;
  raw: RawPoint[];
  allPoints: Point[];
  trips: Trip[];
  speedingEvents: SpeedingEvent[];

  /** local-date string (YYYY-MM-DD) currently selected; null = all dates */
  date: string | null;
  availableDates: string[];
  thresholdKmh: number;

  isPlaying: boolean;
  playbackRate: PlaybackRate;
  /** index into the FILTERED point list */
  playheadIndex: number;

  selectedTripId: string | null;
  selectedEventId: string | null;

  /** monotonic counter — bumped to ask the map to re-fit bounds */
  fitBoundsToken: number;
  /** monotonic counter — bumped to ask the map to fly to `flyToTarget` */
  flyToToken: number;
  flyToTarget: FlyToTarget | null;
};

export type RouteActions = {
  loadData: () => Promise<void>;
  setDate: (d: string | null) => void;
  setThreshold: (n: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlayheadIndex: (i: number) => void;
  setPlaybackRate: (r: PlaybackRate) => void;
  selectTrip: (id: string | null) => void;
  selectEvent: (id: string | null) => void;
  requestFitBounds: () => void;
};

export type RouteStore = RouteState & RouteActions;
```

State groups:

| Group      | Fields                                             | Notes                                                           |
| ---------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Data       | `loadState, raw, allPoints, trips, speedingEvents` | The pipeline outputs from phases 03–04.                         |
| Filters    | `date, availableDates, thresholdKmh`               | The user knobs above the map.                                   |
| Playback   | `isPlaying, playbackRate, playheadIndex`           | `playheadIndex` is **into the filtered list**, not `allPoints`. |
| Selection  | `selectedTripId, selectedEventId`                  | Stable IDs from the pipeline.                                   |
| Map tokens | `fitBoundsToken, flyToToken, flyToTarget`          | Monotonic counters used to trigger imperative Leaflet calls.    |

### 2. Store definition with initial values

Continue the file:

```ts
export const useRouteStore = create<RouteStore>((set, get) => ({
  loadState: { status: "idle" },
  raw: [],
  allPoints: [],
  trips: [],
  speedingEvents: [],

  date: null,
  availableDates: [],
  thresholdKmh: DEFAULT_SPEED_THRESHOLD_KMH,

  isPlaying: false,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  playheadIndex: 0,

  selectedTripId: null,
  selectedEventId: null,
  fitBoundsToken: 0,
  flyToToken: 0,
  flyToTarget: null,

  // ↓↓↓ actions go below ↓↓↓
```

(Keep the closing `}));` for after the actions — don't add it yet.)

### 3. `loadData`

```ts
  loadData: async () => {
    // Guard against React 19 StrictMode double-invocation: skip if a load
    // is already in progress.
    if (get().loadState.status === "loading") return;
    set({ loadState: { status: "loading" } });
    try {
      const raw = await loadVehicleCsv();
      const points = processPoints(raw, get().thresholdKmh);
      const trips = segmentTrips(points);
      const events = buildSpeedingEvents(points);
      const dates = uniqueDates(raw);
      const initialDate = dates[dates.length - 1] ?? null;
      const lastTripOnDate = lastTripFor(trips, initialDate);
      set((s) => ({
        loadState: { status: "ready" },
        raw,
        allPoints: points,
        trips,
        speedingEvents: events,
        availableDates: dates,
        date: initialDate,
        selectedTripId: lastTripOnDate?.id ?? null,
        playheadIndex: 0,
        isPlaying: points.length < 2 ? false : s.isPlaying,
        fitBoundsToken: s.fitBoundsToken + 1,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loadState: { status: "error", message } });
    }
  },
```

- The **StrictMode guard** matters: in dev, React 19 fires `useEffect` twice, so without the guard the CSV would be fetched twice in parallel.
- Defaulting to the **last date** + **last trip on that date** means the user always sees something interesting on first paint.
- **`fitBoundsToken: s.fitBoundsToken + 1`** — bumping the monotonic counter is how we ask the map (which doesn't run yet) to fit the bounds of the freshly-loaded route.

### 4. `setDate` & `setThreshold`

```ts
  setDate: (date) =>
    set((s) => ({
      date,
      playheadIndex: 0,
      selectedTripId: null,
      selectedEventId: null,
      fitBoundsToken: s.fitBoundsToken + 1,
    })),

  setThreshold: (n) => {
    const thresholdKmh = Number.isFinite(n)
      ? Math.max(1, n)
      : DEFAULT_SPEED_THRESHOLD_KMH;
    const points = processPoints(get().raw, thresholdKmh);
    set((s) => ({
      thresholdKmh,
      allPoints: points,
      trips: segmentTrips(points),
      speedingEvents: buildSpeedingEvents(points),
      selectedTripId: null,
      selectedEventId: null,
      fitBoundsToken: s.fitBoundsToken + 1,
    }));
  },
```

- **Threshold is the only knob that re-runs the pipeline.** That's because `isSpeeding` depends on it, which in turn affects trip `speedingCount` and the entire event list. We re-run from `raw` (the cleanest source) so we don't compound any error.
- **Date** is a pure filter — selectors will narrow `allPoints` on the fly.

### 5. Playback actions

```ts
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlayheadIndex: (i) => set({ playheadIndex: Math.max(0, Math.floor(i)) }),
  setPlaybackRate: (r) => set({ playbackRate: r }),
```

Trivial. The only defense is `Math.max(0, Math.floor(i))` — the scrubber is `<input type="range">` which always passes integers, but we belt-and-brace.

### 6. `selectTrip`

```ts
  selectTrip: (id) => {
    if (id === null) {
      set((s) => ({
        selectedTripId: null,
        selectedEventId: null,
        playheadIndex: 0,
        isPlaying: false,
        fitBoundsToken: s.fitBoundsToken + 1,
      }));
      return;
    }
    const trip = get().trips.find((t) => t.id === id);
    if (!trip) return;
    set((s) => ({
      selectedTripId: id,
      selectedEventId: null,
      date: toLocalDateString(trip.startTime),
      playheadIndex: 0,
      isPlaying: false,
      fitBoundsToken: s.fitBoundsToken + 1,
    }));
  },
```

- Selecting a trip **forces the date filter** to the trip's date. This guarantees the trip's points are visible.
- `selectedEventId: null` clears any event selection because the new trip might not contain it.
- `isPlaying: false` — playback always starts paused after a selection so the playhead can be re-anchored.

### 7. `selectEvent`

```ts
  selectEvent: (id) => {
    if (id === null) {
      set({ selectedEventId: null });
      return;
    }
    set((s) => {
      const evt = s.speedingEvents.find((e) => e.id === id);
      if (!evt) return s;

      // Keep current trip selection only if the event lies inside it,
      // otherwise clear it so the event isn't filtered out.
      const currentTrip = findTrip(s.trips, s.selectedTripId);
      const keepTrip =
        currentTrip != null && tripContainsEvent(currentTrip, evt);
      const nextTripId = keepTrip ? s.selectedTripId : null;
      const nextDate = toLocalDateString(evt.startTime);

      // Compute the playhead position against the about-to-be-filtered list.
      const filtered = filterPointsRaw(
        s.allPoints,
        nextDate,
        keepTrip ? currentTrip : null,
      );
      const playIdx = Math.max(
        0,
        filtered.findIndex((p) => p.index >= evt.startIndex),
      );

      return {
        date: nextDate,
        selectedTripId: nextTripId,
        selectedEventId: id,
        playheadIndex: playIdx,
        isPlaying: false,
        flyToToken: s.flyToToken + 1,
        flyToTarget: {
          lat: evt.midLat,
          lng: evt.midLng,
          zoom: MAP_FLY_TO_ZOOM,
        },
      };
    });
  },
```

The interesting bit is the **filtered-list playhead math.** `playheadIndex` is into the filtered list (not `allPoints`), but the event's `startIndex` is into `allPoints`. So:

1. Build the same filtered list the selector will produce next render.
2. `findIndex(p => p.index >= evt.startIndex)` — find the first filtered point at or after the event's first point.
3. `Math.max(0, …)` — `findIndex` returns -1 if not found; clamp to 0.

And we bump `flyToToken` + set `flyToTarget` so the map flies to the event.

### 8. `requestFitBounds` and close

```ts
  requestFitBounds: () =>
    set((s) => ({ fitBoundsToken: s.fitBoundsToken + 1 })),
}));
```

That `}));` closes the store factory. No more `(set, get) => ({` body after this point.

### 9. Internal helpers

```ts
// ---------- internal helpers ----------
// Exported so selectors.ts can reuse them; not part of the public API.

export function findTrip(trips: Trip[], id: string | null): Trip | null {
  if (!id) return null;
  return trips.find((t) => t.id === id) ?? null;
}

export function tripContainsEvent(trip: Trip, evt: SpeedingEvent): boolean {
  return evt.startIndex >= trip.startIndex && evt.endIndex <= trip.endIndex;
}

export function tripOnDate(t: Trip, date: string | null): boolean {
  if (!date) return true;
  return (
    toLocalDateString(t.startTime) === date ||
    toLocalDateString(t.endTime) === date
  );
}

export function filterPointsRaw(
  points: Point[],
  date: string | null,
  trip: Trip | null,
): Point[] {
  return points.filter((p) => {
    if (date && toLocalDateString(p.timestamp) !== date) return false;
    if (trip && (p.index < trip.startIndex || p.index > trip.endIndex)) {
      return false;
    }
    return true;
  });
}

function uniqueDates(raw: RawPoint[]): string[] {
  const set = new Set<string>();
  for (const p of raw) set.add(toLocalDateString(p.timestamp));
  return [...set].sort();
}

function lastTripFor(trips: Trip[], date: string | null): Trip | null {
  const onDate = date ? trips.filter((t) => tripOnDate(t, date)) : trips;
  return onDate[onDate.length - 1] ?? null;
}
```

`findTrip`, `tripContainsEvent`, `tripOnDate`, and `filterPointsRaw` are **exported** so the selectors file can call them. `uniqueDates` and `lastTripFor` stay file-local.

## Sidebar: the monotonic-token pattern

A core problem in this app: **changing state must trigger imperative Leaflet calls** (`map.fitBounds`, `map.flyTo`). Putting `points` in a `useEffect` deps array is wrong — it would fire on every filter change. We want "fire when the _user_ asks", not "fire when the data identity happens to change".

The solution:

1. State holds a `fitBoundsToken: number` (and `flyToToken: number`).
2. Whenever an action wants to fit bounds, it does `set((s) => ({ fitBoundsToken: s.fitBoundsToken + 1 }))`. **Monotonic** — never decreases.
3. Inside the map, a small child component reads the token, compares it against a `useRef` that holds the last token it acted on, and only acts when they differ.

```ts
const lastTokenRef = useRef<number>(-1);
useEffect(() => {
  if (lastTokenRef.current === token) return;
  lastTokenRef.current = token;
  // …imperative call…
}, [token /* other inputs */]);
```

You'll write the consumer side in [09-route-map.md](09-route-map.md). It's only ~6 extra lines per controller, and it's worth memorizing — the same pattern applies any time declarative state needs to drive an imperative side-effect exactly N times.

## File 2: `src/store/selectors.ts`

```ts
import { useShallow } from "zustand/react/shallow";
import { toLocalDateString } from "../lib/date";
import {
  filterPointsRaw,
  findTrip,
  tripOnDate,
  useRouteStore,
} from "./useRouteStore";

/** Points currently shown on the map: by date, narrowed to the selected trip if any. */
export function useFilteredPoints() {
  return useRouteStore(
    useShallow((s) =>
      filterPointsRaw(s.allPoints, s.date, findTrip(s.trips, s.selectedTripId)),
    ),
  );
}

/** All trips for the selected date. */
export function useVisibleTrips() {
  return useRouteStore(
    useShallow((s) => s.trips.filter((t) => tripOnDate(t, s.date))),
  );
}

/** Speeding events for the selected date, narrowed to the selected trip if any. */
export function useVisibleSpeedingEvents() {
  return useRouteStore(
    useShallow((s) => {
      const trip = findTrip(s.trips, s.selectedTripId);
      return s.speedingEvents.filter((e) => {
        if (s.date && toLocalDateString(e.startTime) !== s.date) return false;
        if (
          trip &&
          (e.startIndex < trip.startIndex || e.endIndex > trip.endIndex)
        ) {
          return false;
        }
        return true;
      });
    }),
  );
}
```

### Why `useShallow`?

Each selector returns a **new array** every render. By default Zustand uses `Object.is` to decide if the selected value changed — and a fresh array is always `!== ` the previous one, so the component re-renders constantly. `useShallow` does an element-by-element shallow compare, so as long as the contents haven't actually changed, the component skips re-rendering.

Use `useShallow` **whenever a selector returns an array or a plain object literal**. For a single primitive (`s => s.isPlaying`) you don't need it.

## Pitfalls

> **`playheadIndex` is into the filtered list.** Anywhere you cross-reference it with `allPoints[…]`, you're wrong. The map and playback hook always read the _filtered_ list via the selector.

> **Don't put functions inside `set` updaters that read `get()` synchronously without the functional `set((s) => …)` form** — you risk reading stale state. The codebase consistently uses `set((s) => …)` whenever the new state depends on the previous one.

> **The store re-imports nothing from React.** Zustand can be used outside of React (via `useRouteStore.getState()` and `useRouteStore.setState()`), which the playback hook leans on in the next phase.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean. The store can already be `import`ed and called — but nothing renders it yet. Optional sanity check in `src/scratch.ts`:

```ts
import { useRouteStore } from "./store/useRouteStore";
useRouteStore
  .getState()
  .loadData()
  .then(() => {
    const s = useRouteStore.getState();
    console.log("loaded:", s.allPoints.length, "points");
    console.log("trips:", s.trips.length);
    console.log("dates:", s.availableDates);
  });
```

Wire it temporarily into `index.html` (`<script type="module" src="/src/scratch.ts"></script>`), run `npm run dev`, watch the console, then revert.

➡️ Continue to [07-playback-loop.md](07-playback-loop.md).
