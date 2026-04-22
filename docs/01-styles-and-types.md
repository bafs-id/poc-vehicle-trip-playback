# 01 — Global styles & shared types

## Goal

Lay down the visual foundation (theme variables + every component's CSS) and the TypeScript domain types every later file imports.

These three files have **no dependencies** of their own — they are the bedrock for everything that follows.

## Files to create

### `src/index.css`

Theme variables, dark color-scheme, base resets, system font stack.

```css
:root {
  --bg: #0f172a;
  --panel: #1e293b;
  --panel-2: #273449;
  --border: #334155;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #3b82f6;
  --red: #ef4444;
  --green: #22c55e;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
}

button {
  font: inherit;
  color: inherit;
}

input,
select {
  font: inherit;
}
```

### `src/App.css`

All component-specific styles. The file is long but flat — one section per component. It uses the CSS variables defined in `index.css`.

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}

/* ---------- header ---------- */
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-right: 12px;
}
.brand-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}

.control {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
.control label {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 10px;
}
.control select,
.control input[type="number"] {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 8px;
  border-radius: 6px;
  min-width: 90px;
}
.control--range {
  flex: 1;
  min-width: 280px;
}
.range-pair {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
}
.range-pair input[type="range"] {
  width: 100%;
  appearance: none;
  background: transparent;
}
.range-pair input[type="range"]:nth-child(2) {
  margin-top: -10px;
}

.status {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.status--ok {
  color: var(--green);
}
.status--err {
  color: var(--red);
}

.clear-btn {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.clear-btn:hover {
  border-color: var(--accent);
  color: #fff;
}

/* ---------- main layout ---------- */
.app-main {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 0;
}

.sidebar {
  background: var(--panel);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tab {
  flex: 1;
  background: transparent;
  border: 0;
  padding: 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.tab.active {
  border-bottom-color: var(--accent);
  color: #fff;
}

.badge {
  background: var(--panel-2);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  color: var(--muted);
}
.badge--red {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.tab-body {
  overflow: auto;
  flex: 1;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.list-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.list-item:hover {
  background: var(--panel-2);
}
.list-item.is-selected {
  background: rgba(59, 130, 246, 0.15);
  box-shadow: inset 3px 0 0 var(--accent);
}
.list-item .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.list-item .meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
.empty {
  padding: 16px;
  color: var(--muted);
  text-align: center;
}

/* ---------- map ---------- */
.map-wrap {
  position: relative;
  min-height: 0;
}
.overlay {
  position: absolute;
  z-index: 1000;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.85);
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.overlay--err {
  border-color: var(--red);
  color: #fecaca;
}

.map-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.map-pin--start {
  background: var(--green);
}
.map-pin--end {
  background: var(--red);
}
.map-pin--playhead {
  width: 16px;
  height: 16px;
  background: #facc15;
  border: 3px solid #1e293b;
  box-shadow:
    0 0 0 2px #facc15,
    0 0 12px rgba(250, 204, 21, 0.7);
}

/* ---------- playback ---------- */
.playback {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--panel);
  border-top: 1px solid var(--border);
}

.play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--accent);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
.play-btn:disabled {
  background: var(--panel-2);
  cursor: not-allowed;
  color: var(--muted);
}

.time {
  display: flex;
  flex-direction: column;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  min-width: 100px;
}
.time .speed {
  font-size: 11px;
  color: var(--muted);
}
.time .speed--red {
  color: #fca5a5;
  font-weight: 700;
}

.scrubber {
  width: 100%;
}

.rates {
  display: flex;
  gap: 4px;
}
.rate {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.rate.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
```

### `src/types.ts`

The shared domain vocabulary. Read the JSDoc carefully — `Point.distanceM` / `dtSec` / `speedKmh` describe the segment **from the previous point to this one**, which is a convention the rest of the code relies on.

```ts
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
```

## Walk-through

- **`LoadState` is a discriminated union.** TypeScript narrows the type when you check `loadState.status === "error"` — the `message` field becomes accessible. This is how `App.tsx` will render the error overlay safely.
- **`startIndex` / `endIndex` on `Trip` and `SpeedingEvent`** are positions inside the **full** processed `Point[]` (`allPoints`), **not** the filtered list. Keep that in mind: when you later filter `allPoints` by date+trip, those original indices stay attached so events can still be located after recompute.
- **`FlyToTarget` is `LatLng & { zoom? }`** — a tiny intersection type. You'll see this kind of additive composition all over the codebase.

## Pitfalls

> **`verbatimModuleSyntax` will bite you here.** When you import these types in a later file, you must write `import type { Point } from "./types"` — not just `import { Point }`. TypeScript will refuse to compile the lazier form.

> **Don't add any runtime values to `types.ts`.** Mixing `export const` next to `export type` here causes circular-import headaches once everything is wired up. Keep this file types-only.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean exit. The compiler now knows the project's vocabulary even though no code uses it yet.

```bash
npm run dev
```

Open the page — you should see a dark background (the theme variables are applied via `:root` and `body`), and nothing else.

> If the page is white, you forgot to import `index.css` in `main.tsx`. We haven't built `main.tsx` yet, so this is expected for now. The styles activate in phase 10.

➡️ Continue to [02-pure-utilities.md](02-pure-utilities.md).
