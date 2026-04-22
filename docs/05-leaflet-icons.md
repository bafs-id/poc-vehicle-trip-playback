# 05 — Leaflet icons

## Goal

Patch Leaflet's default marker icon (which Vite breaks) and define the three custom `divIcon`s the map uses for start, end, and the moving playhead.

## File to create

### `src/lib/leafletIcons.ts`

```ts
import L from "leaflet";

/**
 * Patch Leaflet's default marker icon so it works under Vite without
 * needing to bundle the icon assets. Imported for side-effects.
 */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export const startIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--start">S</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export const endIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--end">E</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export const playheadIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--playhead"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
```

## Walk-through

- **Why patch the default icon?** Leaflet ships its marker images as relative URLs (`marker-icon.png` etc.) that it resolves against the URL of `leaflet.js`. Under Vite's bundler, those relative URLs end up pointing at non-existent paths. The simplest fix is to point the default `iconUrl` at unpkg's CDN copy — works in dev and production with no asset-pipeline plumbing.

- **Three `divIcon`s.** Unlike `L.icon`, `divIcon` renders an arbitrary HTML string. Each of ours wraps a single `<div>` with the matching `.map-pin` class from `App.css` (defined in [01-styles-and-types.md](01-styles-and-types.md)). The class controls size, color, border, and box-shadow; the JS only controls the icon's anchor offset.

- **`className: ""`** suppresses Leaflet's default `leaflet-div-icon` wrapper class (which adds a white background we don't want).

- **`iconAnchor` is half of `iconSize`** for the round pins so the _center_ of the circle sits on the GPS coordinate.

- **`L.Marker.prototype.options.icon = DefaultIcon`** is a side-effect mutation. It runs the moment any file `import`s `leafletIcons.ts`. Phase 9's `RouteMap.tsx` imports it — that's enough to apply the patch app-wide.

## Pitfalls

> **This file must be imported somewhere.** TypeScript & ESLint will not flag a missing import — the side-effect just silently doesn't happen. If your default markers ever look broken (404 on `marker-icon.png`), the first thing to check is the import chain.

> **`divIcon` + CSS classes are styled at render time.** If you misspell `.map-pin--start` in `App.css`, you'll get an unstyled `<div>S</div>` floating on the map — a visual bug, not a console error.

> **Don't `new L.DivIcon(...)` — use `L.divIcon(...)`.** The lowercase factory is what `react-leaflet`'s `Marker` expects via the `icon` prop.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean. (No visual checkpoint yet — we'll see the icons appear in phase 10.)

➡️ Continue to [06-state-store.md](06-state-store.md).
