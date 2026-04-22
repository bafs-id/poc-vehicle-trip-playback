# 09 — Route map

## Goal

Build the Leaflet map component. It draws:

- A blue polyline of the filtered route.
- Red sub-runs over the speeding segments.
- Start (S) / End (E) markers.
- A circle marker per speeding event with a popup.
- A yellow playhead marker.

…plus two invisible **controller** components inside `<MapContainer>` that turn store tokens into imperative `map.fitBounds` / `map.flyTo` calls.

## File to create

### `src/components/RouteMap.tsx`

This is the longest component. We'll build it whole and walk through the parts.

```tsx
import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  MAP_DEFAULT_ZOOM,
  MAP_FALLBACK_CENTER,
  MAP_FIT_MAX_ZOOM,
  MAP_FIT_PADDING,
} from "../lib/constants";
import { formatDateTime, formatTime } from "../lib/format";
import { endIcon, playheadIcon, startIcon } from "../lib/leafletIcons";
import { useRouteStore } from "../store/useRouteStore";
import {
  useFilteredPoints,
  useVisibleSpeedingEvents,
} from "../store/selectors";
import type { FlyToTarget, Point, SpeedingEvent } from "../types";

type LatLngTuple = [number, number];

const FLY_TO_DURATION_S = 0.8;

export function RouteMap() {
  const points = useFilteredPoints();
  const events = useVisibleSpeedingEvents();
  const playheadIndex = useRouteStore((s) => s.playheadIndex);
  const fitBoundsToken = useRouteStore((s) => s.fitBoundsToken);
  const flyToToken = useRouteStore((s) => s.flyToToken);
  const flyToTarget = useRouteStore((s) => s.flyToTarget);

  const polyPath = useMemo<LatLngTuple[]>(
    () => points.map((p) => [p.lat, p.lng]),
    [points],
  );
  const redSegments = useMemo(() => buildSpeedingSegments(points), [points]);

  const first = points[0];
  const last = points[points.length - 1];
  const initialCenter: LatLngTuple = first
    ? [first.lat, first.lng]
    : [MAP_FALLBACK_CENTER.lat, MAP_FALLBACK_CENTER.lng];
  const playhead = points[Math.min(playheadIndex, points.length - 1)];

  return (
    <MapContainer
      center={initialCenter}
      zoom={MAP_DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {polyPath.length > 1 && (
        <Polyline
          positions={polyPath}
          pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.85 }}
        />
      )}

      {redSegments.map((seg) => (
        <Polyline
          key={segmentKey(seg)}
          positions={seg}
          pathOptions={{ color: "#ef4444", weight: 6, opacity: 0.95 }}
        />
      ))}

      {first && (
        <Marker position={[first.lat, first.lng]} icon={startIcon}>
          <Popup>Start: {formatDateTime(first.timestamp)}</Popup>
        </Marker>
      )}
      {last && points.length > 1 && (
        <Marker position={[last.lat, last.lng]} icon={endIcon}>
          <Popup>End: {formatDateTime(last.timestamp)}</Popup>
        </Marker>
      )}

      {events.map((e) => (
        <CircleMarker
          key={e.id}
          center={[e.midLat, e.midLng]}
          radius={6}
          pathOptions={{
            color: "#b91c1c",
            fillColor: "#ef4444",
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <EventPopupContent event={e} />
          </Popup>
        </CircleMarker>
      ))}

      {playhead && (
        <Marker position={[playhead.lat, playhead.lng]} icon={playheadIcon} />
      )}

      <BoundsController points={points} token={fitBoundsToken} />
      <FlyToController token={flyToToken} target={flyToTarget} />
    </MapContainer>
  );
}

function EventPopupContent({ event }: { event: SpeedingEvent }) {
  return (
    <div>
      <strong>Speeding</strong>
      <br />
      Peak: {event.peakSpeedKmh.toFixed(1)} km/h
      <br />
      {formatTime(event.startTime)} – {formatTime(event.endTime)}
    </div>
  );
}

function BoundsController({
  points,
  token,
}: {
  points: Point[];
  token: number;
}) {
  const map = useMap();
  const lastTokenRef = useRef<number>(-1);
  useEffect(() => {
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, {
      padding: MAP_FIT_PADDING,
      maxZoom: MAP_FIT_MAX_ZOOM,
    });
  }, [token, points, map]);
  return null;
}

function FlyToController({
  token,
  target,
}: {
  token: number;
  target: FlyToTarget | null;
}) {
  const map = useMap();
  const lastTokenRef = useRef<number>(-1);
  useEffect(() => {
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? MAP_DEFAULT_ZOOM, {
      duration: FLY_TO_DURATION_S,
    });
  }, [token, target, map]);
  return null;
}

/**
 * Walk the points and emit one polyline per run of `isSpeeding` points.
 * Each emitted run includes the previous (non-speeding) point so the red
 * segment renders an actual line rather than a single vertex.
 */
function buildSpeedingSegments(points: Point[]): LatLngTuple[][] {
  const segments: LatLngTuple[][] = [];
  let current: LatLngTuple[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.isSpeeding) {
      if (current.length === 0 && i > 0) {
        const prev = points[i - 1];
        current.push([prev.lat, prev.lng]);
      }
      current.push([p.lat, p.lng]);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function segmentKey(seg: LatLngTuple[]): string {
  const [a, b] = [seg[0], seg[seg.length - 1]];
  return `${a[0]},${a[1]}-${b[0]},${b[1]}-${seg.length}`;
}
```

## Walk-through

### 1. The `MapContainer` shell

`react-leaflet` wraps Leaflet's imperative map API in a React tree. `<MapContainer>` mounts the map exactly once; subsequent renders update its children, not its `center`/`zoom` props. So `center` and `zoom` here are **initial values only** — to move the map after mount, we use `useMap()` from inside a child (the controllers).

`scrollWheelZoom` is a boolean prop turning on wheel-to-zoom.

The `style={{ width: "100%", height: "100%" }}` is required — without an explicit height, Leaflet's tile layer collapses to 0px tall and you get a blank map.

### 2. Blue polyline of the route

```tsx
{polyPath.length > 1 && (
  <Polyline positions={polyPath} pathOptions={{...}} />
)}
```

`useMemo` keeps `polyPath` referentially stable when `points` doesn't change — keeps Leaflet from re-doing diffs unnecessarily. (The React Compiler will likely memoize this anyway, but explicit is clearer.)

### 3. `buildSpeedingSegments`

We want to **overdraw the speeding sub-runs in red** on top of the blue polyline. A "run" is one or more consecutive `isSpeeding` points.

The subtle bit: a run that starts at index `i` is a polyline from `points[i]` to `points[i+1]`… but the **incoming segment** to `points[i]` is the one we want to color red (because that's the segment whose speed exceeded the threshold). So when a run starts, we **prepend the previous non-speeding point** so the red polyline visually begins at the previous point and ends at the speeding point. Without this prepend, an isolated speeding point would render as a single vertex (invisible).

### 4. `segmentKey` for stable React keys

React needs stable keys for sibling polylines so it can reconcile them efficiently. We synthesize one from the run's endpoints + length — collisions are essentially impossible for GPS coordinates.

### 5. Circle markers for speeding events

`CircleMarker` is a fixed-pixel-radius (vs `Circle` which is meters). The popup uses `EventPopupContent` so the content is a real React subtree (would be nice to add interactivity later).

`e.id` (the stable `evt-<startIdx>-<endIdx>` from phase 03) is the React key.

### 6. Start / end / playhead markers

- `first` is rendered if any points are present.
- `last` requires `points.length > 1` so a one-point dataset doesn't render two stacked markers.
- `playhead` uses `Math.min(playheadIndex, points.length - 1)` for the same out-of-range safety as `PlaybackBar`.

### 7. `BoundsController` & `FlyToController` — the token pattern

The pattern (introduced in [06-state-store.md](06-state-store.md)):

```tsx
const lastTokenRef = useRef<number>(-1);
useEffect(() => {
  if (lastTokenRef.current === token) return;
  lastTokenRef.current = token;
  // …imperative call…
}, [token /* other inputs */]);
```

Why is this in a child of `<MapContainer>` (not the outer `RouteMap`)? Because `useMap()` requires being inside the Leaflet tree to get the live map instance. Both controllers return `null` — they exist purely for their effect.

`lastTokenRef` starts at `-1` so the first real token (≥0) always triggers the effect once. Subsequent renders where the token hasn't changed bail out of the effect body even though React re-ran the effect (because `points` or `target` identity changed).

`BoundsController` reads `points` so that fitting bounds uses the **current filtered set**, not the data at the time of the click. That's actually what you want: the user clicks a trip → store fires `setDate` (updating `points`) and bumps `fitBoundsToken` → both arrive in the same render → the effect runs once with both new values.

`FlyToController` honors `target.zoom ?? MAP_DEFAULT_ZOOM` and uses Leaflet's `flyTo` (smooth zoom-and-pan) with `FLY_TO_DURATION_S` seconds.

## Pitfalls

> **`leaflet/dist/leaflet.css` is required.** It's imported in `main.tsx` (next phase). Without it the tiles render but markers are mis-anchored and many controls look broken.

> **Don't change `center` / `zoom` after mount and expect the map to move.** `<MapContainer>` ignores prop changes for those. Always go through a `useMap()` child or via the `MapContainer`'s `whenCreated` callback.

> **Token starts at `-1` in the ref, `0` in the store.** That's deliberate — it ensures the controller fires _once_ on first mount with `token === 0`. If you flip either default, first-mount fit-bounds breaks.

> **`Polyline positions` accepts `[lat, lng]` tuples or `LatLng` objects** — not the project's `Point` type. The `polyPath.map((p) => [p.lat, p.lng])` step exists for that reason.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean. (Visual checkpoint: phase 10.)

➡️ Continue to [10-app-entry.md](10-app-entry.md).
