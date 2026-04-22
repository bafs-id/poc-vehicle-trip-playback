# 11 — Build, preview & next steps

## Goal

Produce a production build, run it locally, recap the architecture, and suggest places to extend the project.

## Production build

```bash
npm run build
```

Runs `tsc -b && vite build`. Output lands in `dist/` — a static bundle. The `tsc -b` step type-checks both `tsconfig.app.json` and `tsconfig.node.json` projects.

```bash
npm run preview
```

Serves `dist/` locally so you can sanity-check the production bundle behaves the same as `npm run dev`.

## Lint

```bash
npm run lint
```

Catches unused imports, missing hook deps (except the one suppressed in `usePlaybackLoop.ts`), and the usual TypeScript gotchas.

## Architectural recap

You built five conceptual layers:

| Layer           | Files                                                            | Why it's separate                                          |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Pure utilities  | `lib/clsx`, `lib/constants`, `lib/date`, `lib/format`, `lib/geo` | No deps. Easy to reason about; trivially testable.         |
| Domain pipeline | `lib/processPoints`, `lib/segmentTrips`, `lib/speedingEvents`    | Pure functions over your domain types. The business logic. |
| I/O             | `lib/loadCsv`, `lib/leafletIcons`                                | Touch the network / global Leaflet object. Confined here.  |
| State           | `store/useRouteStore`, `store/selectors`                         | One source of truth + thin derivation hooks.               |
| Presentation    | `hooks/usePlaybackLoop`, `components/*`, `App.tsx`, `main.tsx`   | React-only. Thin layers on top of the store.               |

The patterns worth memorizing:

- **Shape data once, derive views many times.** The store holds `raw` + `allPoints` + `trips` + `events`; selectors filter by date/trip without recomputing the heavy work.
- **One knob re-runs the pipeline; everything else is filtering.** `setThreshold` re-runs `processPoints`/`segmentTrips`/`buildSpeedingEvents`. `setDate` and `selectTrip` only change selectors.
- **Iterative cleaning** because clustered spikes hide each other.
- **The monotonic-token pattern** for "make this declarative state trigger an imperative side-effect once". `useRef<number>(-1)` + a comparator inside a child of the imperative API's host (`useMap()` here).
- **Read live state inside rAF loops via `getState()`** — never put the live value in the effect deps.
- **Stable IDs (`trip-<hourKey>`, `evt-<startIdx>-<endIdx>`)** so user selections survive recomputes.
- **`useShallow` for selectors that return arrays / object literals** so components don't re-render on every store mutation.

## Where to take this next

- **Real trip detection.** The current "trip = local hour" is crude. Implement a stop-detection algorithm: a trip ends when speed stays under N km/h for ≥M minutes (or distance traveled in M minutes < D meters). Will require splitting `Point[]` into runs and emitting trips between stops; the rest of the app doesn't care.
- **Multiple vehicles.** Add a `vehicleId` to the store, color-code routes, and let the user toggle vehicles in the sidebar. The store will likely grow `Map<vehicleId, RouteData>`-style nesting.
- **Server-pushed live updates.** Replace the one-shot CSV fetch with an EventSource / WebSocket that appends new `RawPoint`s. Re-derive incrementally instead of re-running `processPoints` over the full set.
- **Unit tests.** The pure-function layers (`lib/`) are easy targets:
  - `geo.haversineMeters` — known-distance fixtures (Bangkok–Chiang Mai, etc).
  - `processPoints.detectSpikeIndices` — synthetic out-and-back fixtures.
  - `segmentTrips` — verify hour bucketing across a UTC midnight.
  - `speedingEvents.buildSpeedingEvents` — verify the gap tolerance behavior.
  - `loadCsv.parseTimestamp` — every timestamp variant.
- **Persistence.** Save user preferences (threshold, last-selected date, playback rate) to `localStorage` via Zustand's `persist` middleware.
- **Performance for very large CSVs.** Replace the in-memory `RawPoint[]` with a typed-array layout, sample on zoom level for the polyline, and tile the speeding events.
- **i18n.** All formatting goes through `lib/format.ts` already — swap to `Intl.DateTimeFormat` with an explicit locale and you're most of the way there.

That's it — you've reproduced the full project from an empty directory. Have fun extending it.
