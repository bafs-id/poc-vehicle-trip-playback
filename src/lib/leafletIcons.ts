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
