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
  useFilteredPoints,
  useRouteStore,
  useVisibleSpeedingEvents,
} from "../store/useRouteStore";
import type { Point } from "../types";

// Fix default Leaflet marker assets (Vite-friendly: use CDN URLs)
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

const startIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--start">S</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const endIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--end">E</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const playheadIcon = L.divIcon({
  className: "",
  html: '<div class="map-pin map-pin--playhead"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function RouteMap() {
  const points = useFilteredPoints();
  const events = useVisibleSpeedingEvents();
  const playheadIndex = useRouteStore((s) => s.playheadIndex);
  const fitBoundsToken = useRouteStore((s) => s.fitBoundsToken);
  const flyToToken = useRouteStore((s) => s.flyToToken);
  const flyToTarget = useRouteStore((s) => s.flyToTarget);

  const polyPath = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );

  // build red sub-polylines for speeding segments
  const redSegments = useMemo(() => buildSpeedingSegments(points), [points]);

  const initialCenter: [number, number] = points[0]
    ? [points[0].lat, points[0].lng]
    : [13.6844, 100.7437];

  const playhead = points[Math.min(playheadIndex, points.length - 1)];

  return (
    <MapContainer
      center={initialCenter}
      zoom={15}
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

      {redSegments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg}
          pathOptions={{ color: "#ef4444", weight: 6, opacity: 0.95 }}
        />
      ))}

      {points[0] && (
        <Marker position={[points[0].lat, points[0].lng]} icon={startIcon}>
          <Popup>Start: {points[0].timestamp.toLocaleString()}</Popup>
        </Marker>
      )}
      {points.length > 1 && (
        <Marker
          position={[
            points[points.length - 1].lat,
            points[points.length - 1].lng,
          ]}
          icon={endIcon}
        >
          <Popup>
            End: {points[points.length - 1].timestamp.toLocaleString()}
          </Popup>
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
            <div>
              <strong>Speeding</strong>
              <br />
              Peak: {e.peakSpeedKmh.toFixed(1)} km/h
              <br />
              {e.startTime.toLocaleTimeString()} –{" "}
              {e.endTime.toLocaleTimeString()}
            </div>
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
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
  }, [token, points, map]);
  return null;
}

function FlyToController({
  token,
  target,
}: {
  token: number;
  target: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  const lastTokenRef = useRef<number>(-1);
  useEffect(() => {
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 16, { duration: 0.8 });
  }, [token, target, map]);
  return null;
}

function buildSpeedingSegments(points: Point[]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.isSpeeding) {
      // include the previous point so the red segment renders an actual line
      if (cur.length === 0 && i > 0) {
        const prev = points[i - 1];
        cur.push([prev.lat, prev.lng]);
      }
      cur.push([p.lat, p.lng]);
    } else if (cur.length > 0) {
      segs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) segs.push(cur);
  return segs;
}
