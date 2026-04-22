# poc-vehicle-route

A single-page React app that visualizes a vehicle's GPS history on a Leaflet map, detects speeding events, and lets you scrub/play the journey along a timeline.

## Features

- Loads GPS logs from CSVs in [public/vehicle_logs/](public/vehicle_logs/) and switches between vehicles.
- Cleans GPS spikes, computes per-segment speed, and flags speeding points above a user-set threshold.
- Buckets points into per-hour **trips** and groups consecutive over-speed points into **speeding events**.
- Renders the route on a Leaflet map: blue polyline + red speeding sub-runs + start/end markers + event markers + a moving playhead.
- Filter by date, click a trip, adjust the speed threshold, scrub the timeline, and play at 1× / 2× / 4× / 8× / 16×.
- Fly the map to any speeding event.

## Tech stack

| Area     | Choice                                                                                    |
| -------- | ----------------------------------------------------------------------------------------- |
| Build    | Vite 8 + React Compiler (via `@rolldown/plugin-babel`)                                    |
| UI       | React 19, plain CSS                                                                       |
| Map      | `leaflet` 1.9 + `react-leaflet` 5                                                         |
| State    | `zustand` 5 (with `useShallow` selectors)                                                 |
| Data     | `papaparse` 5                                                                             |
| Language | TypeScript 6 (strict-ish: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`) |
| Lint     | ESLint 9 flat config + `typescript-eslint` + react-hooks/refresh                          |

## Prerequisites

- **Node.js** ≥ 20.19 (Vite 8 requirement).
- **npm** (or pnpm/yarn).

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Scripts

- `npm run dev` — start the Vite dev server with HMR.
- `npm run build` — type-check with `tsc -b` and produce a production build in `dist/`.
- `npm run preview` — serve the built `dist/` locally.
- `npm run lint` — run ESLint over the project.

## Data

Vehicle logs live in [public/vehicle_logs/](public/vehicle_logs/). [index.json](public/vehicle_logs/index.json) lists the available vehicles; each entry points at a CSV served from the same directory. The loader only reads `Latitude`, `Longitude`, and `CreatedDate` columns — other columns are ignored.

To add a new vehicle:

1. Drop its CSV into [public/vehicle_logs/](public/vehicle_logs/).
2. Add an entry to [index.json](public/vehicle_logs/index.json) with a unique `id`, the `fileName`, and its `url`.

## Project layout

```
src/
├── App.tsx                 # top-level layout + data bootstrap
├── main.tsx                # React entry
├── components/             # Header, Sidebar, RouteMap, PlaybackBar
├── hooks/usePlaybackLoop.ts
├── lib/                    # pure utilities + domain pipeline
│   ├── processPoints.ts    # spike cleaning + speed computation
│   ├── segmentTrips.ts     # per-hour trip bucketing
│   ├── speedingEvents.ts   # over-speed run grouping
│   ├── loadCsv.ts          # CSV fetching + parsing
│   ├── leafletIcons.ts     # marker icon patches
│   └── ...                 # clsx, constants, date, format, geo
├── store/                  # Zustand store + selectors
└── types.ts
```

## Architecture notes

- **Shape data once, derive views many times.** The store holds `raw` + `allPoints` + `trips` + `events`; selectors filter by date/trip without recomputing the heavy work.
- **Threshold is the only knob that re-runs the pipeline.** Date / trip changes are pure filters.
- **Spike cleaning is iterative** because adjacent bad points hide each other.
- **Stable IDs** for trips (`trip-<hourKey>`) and events (`evt-<startIdx>-<endIdx>`) survive recomputes so user selections persist across threshold changes.
- **Playback** uses `requestAnimationFrame`; the loop reads `playheadIndex` via `getState()` so it doesn't re-subscribe every tick.

## Docs

A full build-it-yourself tutorial that rebuilds the project from an empty directory lives in [docs/](docs/). Start with [docs/README.md](docs/README.md).
