# 08 — Non-map components

## Goal

Build the three components that don't touch Leaflet: the top **Header**, the left **Sidebar**, and the bottom **PlaybackBar**. Each is a thin wrapper around the store.

## Files to create

### `src/components/Header.tsx`

```tsx
import { useShallow } from "zustand/react/shallow";
import { useRouteStore } from "../store/useRouteStore";

export function Header() {
  const {
    date,
    availableDates,
    setDate,
    threshold,
    setThreshold,
    loadState,
    selectedTripId,
    selectTrip,
  } = useRouteStore(
    useShallow((s) => ({
      date: s.date,
      availableDates: s.availableDates,
      setDate: s.setDate,
      threshold: s.thresholdKmh,
      setThreshold: s.setThreshold,
      loadState: s.loadState,
      selectedTripId: s.selectedTripId,
      selectTrip: s.selectTrip,
    })),
  );

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-dot" /> Vehicle Route History
      </div>

      <div className="control">
        <label>Date</label>
        <select
          value={date ?? ""}
          onChange={(e) => setDate(e.target.value || null)}
          disabled={availableDates.length === 0}
        >
          {availableDates.length === 0 && <option value="">—</option>}
          {availableDates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {selectedTripId && (
        <button className="clear-btn" onClick={() => selectTrip(null)}>
          Show all trips
        </button>
      )}

      <div className="control">
        <label>Speed limit (km/h)</label>
        <input
          type="number"
          min={1}
          max={300}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      </div>

      <div className="status">
        {loadState.status === "loading" && <span>Loading…</span>}
        {loadState.status === "error" && (
          <span className="status--err">Error</span>
        )}
        {loadState.status === "ready" && (
          <span className="status--ok">Ready</span>
        )}
      </div>
    </header>
  );
}
```

#### Walk-through

- **`useShallow(...)` selects an object** with eight fields. Without it, the component would re-render every time _any_ store field changed (because the selector returns a fresh object literal each call). With `useShallow`, it re-renders only when one of the eight fields actually changes.
- **`setDate(e.target.value || null)`** — `<select>` always returns a string. We coerce empty string → `null` so "no date" stays null in the store.
- **"Show all trips"** button is conditionally rendered only when something is selected. Clicking it calls `selectTrip(null)`, which clears the trip filter (see `selectTrip` in [06-state-store.md](06-state-store.md)).
- **The `loadState` switch is a discriminated-union in action.** The `idle` status renders nothing.

### `src/components/Sidebar.tsx`

```tsx
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "../lib/clsx";
import {
  formatDurationSeconds,
  formatEventDistance,
  formatTime,
} from "../lib/format";
import { useRouteStore } from "../store/useRouteStore";
import { useVisibleSpeedingEvents, useVisibleTrips } from "../store/selectors";
import type { SpeedingEvent, Trip } from "../types";

type Tab = "trips" | "speeding";

export function Sidebar() {
  const [tab, setTab] = useState<Tab>("trips");
  const trips = useVisibleTrips();
  const events = useVisibleSpeedingEvents();
  const { selectTrip, selectEvent, selectedTripId, selectedEventId } =
    useRouteStore(
      useShallow((s) => ({
        selectTrip: s.selectTrip,
        selectEvent: s.selectEvent,
        selectedTripId: s.selectedTripId,
        selectedEventId: s.selectedEventId,
      })),
    );

  return (
    <aside className="sidebar">
      <div className="tabs">
        <button
          className={clsx("tab", tab === "trips" && "active")}
          onClick={() => setTab("trips")}
        >
          Trips <span className="badge">{trips.length}</span>
        </button>
        <button
          className={clsx("tab", tab === "speeding" && "active")}
          onClick={() => setTab("speeding")}
        >
          Speeding <span className="badge badge--red">{events.length}</span>
        </button>
      </div>

      <div className="tab-body">
        {tab === "trips" && (
          <ul className="list">
            {trips.length === 0 && (
              <li className="empty">No trips in this window.</li>
            )}
            {trips.map((t) => (
              <TripRow
                key={t.id}
                trip={t}
                selected={selectedTripId === t.id}
                onSelect={() => selectTrip(t.id)}
              />
            ))}
          </ul>
        )}

        {tab === "speeding" && (
          <ul className="list">
            {events.length === 0 && (
              <li className="empty">No over-speed events in this window.</li>
            )}
            {events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                selected={selectedEventId === e.id}
                onSelect={() => selectEvent(e.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function TripRow({
  trip,
  selected,
  onSelect,
}: {
  trip: Trip;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={clsx("list-item", selected && "is-selected")}
      onClick={onSelect}
    >
      <div className="row">
        <strong>
          {formatTime(trip.startTime)} – {formatTime(trip.endTime)}
        </strong>
        {trip.speedingCount > 0 && (
          <span className="badge badge--red">{trip.speedingCount} over</span>
        )}
      </div>
      <div className="meta">
        {trip.distanceKm.toFixed(2)} km · max {trip.maxSpeedKmh.toFixed(0)} km/h
        · avg {trip.avgSpeedKmh.toFixed(0)} km/h
      </div>
    </li>
  );
}

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: SpeedingEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  return (
    <li
      className={clsx("list-item", selected && "is-selected")}
      onClick={onSelect}
    >
      <div className="row">
        <strong>{formatTime(event.startTime)}</strong>
        <span className="badge badge--red">
          {event.peakSpeedKmh.toFixed(0)} km/h
        </span>
      </div>
      <div className="meta">
        {formatDurationSeconds(durationMs)} ·{" "}
        {formatEventDistance(event.distanceKm)}
      </div>
    </li>
  );
}
```

#### Walk-through

- **Local `useState<Tab>` for the active tab** — purely presentational state, doesn't belong in the store.
- **`TripRow` and `EventRow` are sub-components in the same file.** They're tiny and only used here, so co-locating saves an import.
- **`durationMs` is derived inline.** No memoization needed for this kind of cheap math; React Compiler will memoize the row body if it ever matters.

### `src/components/PlaybackBar.tsx`

```tsx
import { useShallow } from "zustand/react/shallow";
import { clsx } from "../lib/clsx";
import { PLAYBACK_RATES } from "../lib/constants";
import { useRouteStore } from "../store/useRouteStore";
import { useFilteredPoints } from "../store/selectors";

export function PlaybackBar() {
  const points = useFilteredPoints();
  const {
    isPlaying,
    togglePlay,
    playheadIndex,
    setPlayheadIndex,
    playbackRate,
    setPlaybackRate,
  } = useRouteStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      togglePlay: s.togglePlay,
      playheadIndex: s.playheadIndex,
      setPlayheadIndex: s.setPlayheadIndex,
      playbackRate: s.playbackRate,
      setPlaybackRate: s.setPlaybackRate,
    })),
  );

  const max = Math.max(0, points.length - 1);
  const current = points[Math.min(playheadIndex, max)];
  const speedNow = current?.speedKmh ?? 0;
  const disabled = points.length < 2;

  return (
    <footer className="playback">
      <button
        className="play-btn"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="time">
        {current ? current.timestamp.toLocaleTimeString() : "—"}
        <span className={clsx("speed", current?.isSpeeding && "speed--red")}>
          {speedNow.toFixed(0)} km/h
        </span>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(playheadIndex, max)}
        onChange={(e) => setPlayheadIndex(Number(e.target.value))}
        disabled={disabled}
      />

      <div className="rates">
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            className={clsx("rate", playbackRate === r && "active")}
            onClick={() => setPlaybackRate(r)}
          >
            {r}x
          </button>
        ))}
      </div>
    </footer>
  );
}
```

#### Walk-through

- **`Math.min(playheadIndex, max)`** — protects against the playhead being out of range mid-recompute (e.g. user shrinks the dataset by changing date while playing).
- **`current?.isSpeeding && "speed--red"`** — the `clsx` helper lets us pass `false` and it just gets filtered out. So when `current` is undefined or not speeding, the class is omitted.
- **`disabled={points.length < 2}`** — the playback hook's safety net is also enforced here, so the user can't even press play with no data.

## Pitfalls

> **`<input type="range">` always emits strings.** `Number(e.target.value)` is required; otherwise `setPlayheadIndex("42")` would propagate a string into the store and break later math.

> **Don't put `useState` for the active tab in the Zustand store.** Keep transient UI-only state local. The rule of thumb: _if reloading the page should forget it, it doesn't belong in the store_.

> **Empty list message.** Both lists render an `.empty` `<li>` instead of returning `null`. Visually friendlier than a blank panel and helps the user understand "the filter excluded everything".

## Checkpoint

```bash
npx tsc --noEmit
```

Clean.

You can do a partial visual check by stubbing `App.tsx` to render only `Header` + `Sidebar` + `PlaybackBar` (no map yet). Replace `src/App.tsx` and `src/main.tsx` temporarily:

```tsx
// src/App.tsx (TEMPORARY)
import { useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { PlaybackBar } from "./components/PlaybackBar";
import { useRouteStore } from "./store/useRouteStore";
import "./App.css";

export default function App() {
  const loadData = useRouteStore((s) => s.loadData);
  useEffect(() => {
    loadData();
  }, [loadData]);
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Sidebar />
        <div className="map-wrap" style={{ background: "#111" }}>
          (map goes here)
        </div>
      </main>
      <PlaybackBar />
    </div>
  );
}
```

```tsx
// src/main.tsx (TEMPORARY)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`npm run dev` → you should see:

- Dark header with a date dropdown populated from the CSV, "Speed limit" input, "Ready" status.
- Left sidebar with a "Trips" tab listing per-hour trips and a "Speeding" tab with detected events.
- Bottom playback bar with a play button, current time, scrubber, and rate buttons.

The middle panel just says "(map goes here)". Phases 09 and 10 wire it up.

> Don't keep these temporary stubs — they get overwritten in phase 10. Either delete now or remember to overwrite then.

➡️ Continue to [09-route-map.md](09-route-map.md).
