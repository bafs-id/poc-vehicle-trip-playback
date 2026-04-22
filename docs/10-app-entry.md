# 10 — App entry & full wire-up

## Goal

Replace the temporary stubs with the real `App.tsx` and `main.tsx`, then run the app end-to-end. Everything you've built so far snaps together.

## Files to create / overwrite

### `src/App.tsx`

```tsx
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RouteMap } from "./components/RouteMap";
import { PlaybackBar } from "./components/PlaybackBar";
import { useRouteStore } from "./store/useRouteStore";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import "./App.css";

function App() {
  const { loadState, loadData } = useRouteStore(
    useShallow((s) => ({ loadState: s.loadState, loadData: s.loadData })),
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePlaybackLoop();

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Sidebar />
        <div className="map-wrap">
          {loadState.status === "error" && (
            <div className="overlay overlay--err">
              Failed to load: {loadState.message}
            </div>
          )}
          {loadState.status === "loading" && (
            <div className="overlay">Loading vehicle history…</div>
          )}
          <RouteMap />
        </div>
      </main>
      <PlaybackBar />
    </div>
  );
}

export default App;
```

### `src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

## Walk-through

- **`useEffect(() => { loadData(); }, [loadData])`** kicks off the CSV fetch on first mount. The store's StrictMode guard makes it safe under React 19's double-fire dev behavior.
- **`usePlaybackLoop()` is invoked at the App root**, not inside `PlaybackBar`. The hook's lifecycle is tied to `App` so it survives any UI re-arrangement and runs even if `PlaybackBar` is unmounted (e.g. for a "presentation mode" later).
- **The loading/error overlays are siblings of `<RouteMap />`** and use absolute positioning (defined in `App.css`'s `.overlay`). They float over the (still-present) map so layout doesn't jump when they appear.
- **Import order in `main.tsx` matters:** `leaflet/dist/leaflet.css` first (so its rules are at lower precedence than ours), then `index.css` (global theme), then the App.

## Pitfalls

> **Don't move `import "leaflet/dist/leaflet.css"` into `RouteMap.tsx`.** It works there too, but moving it means the CSS only loads after `RouteMap` mounts — causing a flash of unstyled tiles on first paint.

> **Don't remove `<StrictMode>`.** Catching the double-effect bug now (with the `loadData` guard) is much cheaper than tracking it down in production. The store is designed to handle StrictMode correctly; keep it on.

> **`createRoot(...)!`.** The `!` non-null asserts that `#root` exists. If you ever start seeing "Cannot read properties of null", check `index.html` actually has `<div id="root">`.

## Checkpoint — the big one

```bash
npm run dev
```

Open the printed URL. You should see, in order:

1. A brief "Loading vehicle history…" overlay over a default-positioned map.
2. The map snaps to fit the full route. The header's status flips to **Ready** (green), date dropdown lists every date in the CSV, and the latest date is preselected with the latest trip selected on it.
3. The sidebar's **Trips** tab lists per-hour trips for the selected date; the **Speeding** tab shows over-speed events.
4. The blue polyline traces the route; red segments overdraw any speeding sub-runs; circle markers mark each event; **S** and **E** pins mark start and end; a yellow playhead sits at the start.
5. Click a **trip** in the sidebar → map fits to that trip's points; sidebar trip is highlighted; the "Show all trips" button appears in the header.
6. Click a **speeding event** → map flies (smooth animation) to that event; sidebar event is highlighted; playhead jumps to the event's start.
7. Click the play button → playhead glides forward at 4× by default. Try 16× — it should fly. Try 1× — should be near-real-time.
8. Drag the **scrubber** → playhead jumps. The current time + speed update; the speed turns red while inside a speeding sub-run.
9. Change the **Speed limit** → speeding count, red segments, event list, and trip "over" badges all recompute.
10. Pick a different **date** → fresh trips/events/route load.

```bash
npm run lint
```

Should pass. The only intentional eslint suppression is in `usePlaybackLoop.ts`.

```bash
npx tsc --noEmit
```

Clean.

➡️ Continue to [11-build-and-next-steps.md](11-build-and-next-steps.md).
