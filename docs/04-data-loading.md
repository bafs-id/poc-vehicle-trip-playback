# 04 — Data loading

## Goal

Get a CSV of vehicle locations into `public/`, then write the loader that fetches it, normalizes the timestamps, parses it with PapaParse, and returns sorted `RawPoint[]`.

## Files to create

### `public/vehicle_locations.csv`

The loader only reads three columns: `Latitude`, `Longitude`, `CreatedDate`. The original CSV has many more (it's an export from a vehicle tracking system); they're harmless because Papa Parse with `header: true` only reads named fields.

A **minimal valid CSV** would be:

```
Latitude,Longitude,CreatedDate
13.6844225,100.7436523,2026-04-22 07:00:00.0412456 +07:00
13.6844225,100.7436523,2026-04-22 07:00:05.0383340 +07:00
13.6844244,100.7436523,2026-04-22 07:00:25.0346966 +07:00
```

Use one of:

1. **Reuse the original** — copy `public/vehicle_locations.csv` from the source repo (~4800 rows, ~830 KB).
2. **Generate your own** — any CSV with those three columns will work. Keep the timestamp format the same (we'll see why below).

### `src/lib/loadCsv.ts`

```ts
import Papa from "papaparse";
import type { RawPoint } from "../types";

type Row = {
  Latitude: string;
  Longitude: string;
  CreatedDate: string;
};

const DEFAULT_CSV_URL = "/vehicle_locations.csv";

/** Fetch the vehicle CSV and return parsed points sorted by timestamp. */
export async function loadVehicleCsv(
  url: string = DEFAULT_CSV_URL,
): Promise<RawPoint[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  return parseVehicleCsv(text);
}

/** Parse the vehicle CSV text into points sorted by timestamp. */
export function parseVehicleCsv(text: string): RawPoint[] {
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row})`);
  }

  const points: RawPoint[] = [];
  for (const row of parsed.data) {
    const lat = Number(row.Latitude);
    const lng = Number(row.Longitude);
    const timestamp = parseTimestamp(row.CreatedDate);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!timestamp) continue;
    points.push({ lat, lng, timestamp });
  }

  points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return points;
}

const TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2}:?\d{2}|Z)?$/;

/**
 * The CSV uses ".NNNNNNN" sub-second precision plus a "+07:00" offset, e.g.
 * "2026-04-22 07:00:00.0412456 +07:00". `Date` can't parse that natively, so
 * normalize it to ISO 8601 first. Sub-millisecond precision is dropped.
 */
function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(TIMESTAMP_RE);
  if (!m) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, date, time, frac, tz] = m;
  const ms = frac ? frac.slice(0, 3).padEnd(3, "0") : "000";
  const offset = tz
    ? tz === "Z"
      ? "Z"
      : tz.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")
    : "Z";
  const d = new Date(`${date}T${time}.${ms}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

## Walk-through

- **Why a regex?** The string `"2026-04-22 07:00:00.0412456 +07:00"` is _not_ ISO 8601:
  - The space between date and time should be `T`.
  - 7-digit fractional seconds (`.0412456`) — `Date` only honors 3.
  - `+07:00` is fine; `+0700` (without colon) is _not_ — V8 returns `Invalid Date`.
  - The space before the offset must go.

  The regex captures the four pieces, then we re-assemble:
  - `date` and `time` go in literally.
  - `frac.slice(0, 3).padEnd(3, "0")` truncates to milliseconds.
  - `tz.replace(...)` inserts the colon if it was missing.

- **Fallback path:** if the regex doesn't match, we still try `new Date(trimmed)` — covers reasonable ISO inputs without the regex needing to match every variation. `null` propagates and the row is silently skipped (`if (!timestamp) continue;`).

- **Sort by timestamp.** The CSV may not be strictly chronological after a fleet system retry; downstream kinematics assume monotonic time.

- **`DEFAULT_CSV_URL = "/vehicle_locations.csv"`.** Vite serves anything in `public/` at the URL root. Same-origin `fetch("/vehicle_locations.csv")` Just Works in dev and in `vite preview` / production.

## Pitfalls

> **The unused columns aren't ignored — they're parsed.** With `header: true`, Papa Parse builds a row object with **every** column. We only _read_ `Latitude` / `Longitude` / `CreatedDate`. If the CSV has rows with embedded unquoted commas in those other columns, Papa will report errors and `parseVehicleCsv` will throw — even though we wouldn't have used the broken cells. Quote them properly upstream or strip the unused columns.

> **Sub-millisecond precision is lost.** Two samples that differ only by microseconds will collide on `getTime()`. Practically harmless for vehicle data sampled every 5 s, but worth knowing.

> **`fetch` errors come from `res.ok`, not from network failure alone.** A 404 returns `res.ok === false` — without the explicit check, the loader would happily parse an HTML 404 page and emit weird CSV errors.

## Checkpoint

Add a one-liner to `src/scratch.ts` and a tiny HTML host so we can hit the dev server:

```ts
// src/scratch.ts
import { loadVehicleCsv } from "./lib/loadCsv";
loadVehicleCsv().then((pts) => {
  console.log("loaded", pts.length, "points");
  console.log("first:", pts[0]);
  console.log("last:", pts[pts.length - 1]);
});
```

Then temporarily add `<script type="module" src="/src/scratch.ts"></script>` to `index.html` (next to the existing `main.tsx` script line — but `main.tsx` doesn't exist yet, so for now you can replace it).

Run `npm run dev`, open the page, look at the browser DevTools console:

```
loaded 4796 points
first: { lat: 13.6869…, lng: 100.7538…, timestamp: Sun Apr 22 2026 07:00:01 GMT+0700 }
…
```

> If you see `Failed to fetch CSV: 404`, the file isn't at `public/vehicle_locations.csv`. Vite **does not serve `src/`** as static assets — make sure the file is in `public/`.

Restore `index.html` (the original `<script type="module" src="/src/main.tsx"></script>`) and delete `src/scratch.ts` before continuing.

➡️ Continue to [05-leaflet-icons.md](05-leaflet-icons.md).
