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
