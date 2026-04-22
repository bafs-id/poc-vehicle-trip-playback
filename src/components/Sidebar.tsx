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
