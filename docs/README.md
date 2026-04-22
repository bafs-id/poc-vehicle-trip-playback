# Build-It-Yourself Guide — `poc-vehicle-route`

A step-by-step tutorial for rebuilding this project from an empty directory by typing every line of code yourself. Each phase is one Markdown file; the order matters — each step only depends on what came before so the project compiles continuously.

## What you will build

A single-page React app that:

- Loads a vehicle's GPS history from a CSV in `public/`.
- Cleans GPS spikes, computes per-segment speed, and flags speeding.
- Buckets points into per-hour "trips".
- Groups consecutive over-speed points into "speeding events".
- Renders the route on a Leaflet map (blue line + red speeding sub-runs + start/end + event markers + a moving playhead).
- Lets the user filter by date, click a trip, change the speed threshold, scrub/play the journey at 1× / 2× / 4× / 8× / 16×, and fly the map to any speeding event.

## Tech stack

| Area     | Choice                                                                                    |
| -------- | ----------------------------------------------------------------------------------------- |
| Build    | Vite 8 + React Compiler (via `@rolldown/plugin-babel`)                                    |
| UI       | React 19, plain CSS (custom theme variables, no UI lib)                                   |
| Map      | `leaflet` 1.9 + `react-leaflet` 5                                                         |
| State    | `zustand` 5 (with `useShallow` selectors)                                                 |
| Data     | `papaparse` 5                                                                             |
| Language | TypeScript 6 (strict-ish: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`) |
| Lint     | ESLint 9 flat config + `typescript-eslint` + react-hooks/refresh                          |

## Prerequisites

- **Node.js** ≥ 20.19 (Vite 8 requirement).
- **npm** (or pnpm/yarn — adapt commands as needed).
- A CSV with at least `Latitude`, `Longitude`, `CreatedDate` columns. The original repo's CSV has more columns but the loader only reads those three.

## How to read this guide

1. Work through the phases in numerical order. Don't skip — later phases assume earlier files exist.
2. Each phase doc has the same shape:
   - **Goal** — one-paragraph summary.
   - **Files to create** — full file contents you should type / paste verbatim. Filenames are workspace-relative.
   - **Walk-through** — explanation of the _why_ behind the non-obvious code.
   - **Pitfalls** — gotchas worth knowing before they bite.
   - **Checkpoint** — what to run and what you should see.
3. The app is **not visually runnable end-to-end until phase 10**. Earlier phases use compile-time checkpoints (`npx tsc --noEmit`) and small `console.log` smoke tests.
4. You can `git commit` after each phase — recommended but not required.

## Reading order

| #   | File                                                                                 | Topic                                             |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 00  | [00-setup.md](00-setup.md)                                                           | Vite scaffold, deps, configs                      |
| 01  | [01-styles-and-types.md](01-styles-and-types.md)                                     | Global CSS + shared TypeScript types              |
| 02  | [02-pure-utilities.md](02-pure-utilities.md)                                         | `clsx`, constants, date, format, geo              |
| 03  | [03-domain-pipeline.md](03-domain-pipeline.md)                                       | `processPoints`, `segmentTrips`, `speedingEvents` |
| 04  | [04-data-loading.md](04-data-loading.md)                                             | CSV file + `loadCsv.ts`                           |
| 05  | [05-leaflet-icons.md](05-leaflet-icons.md)                                           | Leaflet default-icon patch + custom div icons     |
| 06  | [06-state-store.md](06-state-store.md)                                               | Zustand store + selectors                         |
| 07  | [07-playback-loop.md](07-playback-loop.md)                                           | rAF playback hook                                 |
| 08  | [08-components-header-sidebar-playback.md](08-components-header-sidebar-playback.md) | Non-map components                                |
| 09  | [09-route-map.md](09-route-map.md)                                                   | Leaflet map component                             |
| 10  | [10-app-entry.md](10-app-entry.md)                                                   | `App.tsx` + `main.tsx`, full app run              |
| 11  | [11-build-and-next-steps.md](11-build-and-next-steps.md)                             | `build`, `lint`, recap, ideas                     |

## Architectural takeaways (preview)

You'll see these patterns recur — good things to internalize while building:

- **Shape data once, derive views many times.** The store holds `raw` + `allPoints` + `trips` + `events`; selectors filter by date/trip without recomputing the heavy work.
- **Threshold is the only knob that re-runs the pipeline.** Date / trip changes are pure filters.
- **Spike cleaning is iterative** because adjacent bad points hide each other.
- **The "token" pattern** (monotonic counter + `useRef` comparator inside a `useMap` child) is how purely-declarative state can drive imperative Leaflet calls.
- **The playback loop reads `playheadIndex` via `getState()`** to keep the rAF effect from re-subscribing every tick.
- **Stable IDs** for trips (`trip-<hourKey>`) and events (`evt-<startIdx>-<endIdx>`) survive recomputes so user selections are preserved across threshold changes.
