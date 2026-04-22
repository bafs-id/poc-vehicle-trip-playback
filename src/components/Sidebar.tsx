import { useState } from "react";
import {
  useRouteStore,
  useVisibleSpeedingEvents,
  useVisibleTrips,
} from "../store/useRouteStore";

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export function Sidebar() {
  const [tab, setTab] = useState<"trips" | "speeding">("trips");
  const trips = useVisibleTrips();
  const events = useVisibleSpeedingEvents();
  const selectTrip = useRouteStore((s) => s.selectTrip);
  const selectEvent = useRouteStore((s) => s.selectEvent);
  const selectedTripId = useRouteStore((s) => s.selectedTripId);
  const selectedEventId = useRouteStore((s) => s.selectedEventId);

  return (
    <aside className="sidebar">
      <div className="tabs">
        <button
          className={tab === "trips" ? "tab active" : "tab"}
          onClick={() => setTab("trips")}
        >
          Trips <span className="badge">{trips.length}</span>
        </button>
        <button
          className={tab === "speeding" ? "tab active" : "tab"}
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
              <li
                key={t.id}
                className={
                  "list-item " + (selectedTripId === t.id ? "is-selected" : "")
                }
                onClick={() => selectTrip(t.id)}
              >
                <div className="row">
                  <strong>
                    {fmtTime(t.startTime)} – {fmtTime(t.endTime)}
                  </strong>
                  {t.speedingCount > 0 && (
                    <span className="badge badge--red">
                      {t.speedingCount} over
                    </span>
                  )}
                </div>
                <div className="meta">
                  {t.distanceKm.toFixed(2)} km · max {t.maxSpeedKmh.toFixed(0)}{" "}
                  km/h · avg {t.avgSpeedKmh.toFixed(0)} km/h
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "speeding" && (
          <ul className="list">
            {events.length === 0 && (
              <li className="empty">No over-speed events in this window.</li>
            )}
            {events.map((e) => (
              <li
                key={e.id}
                className={
                  "list-item " + (selectedEventId === e.id ? "is-selected" : "")
                }
                onClick={() => selectEvent(e.id)}
              >
                <div className="row">
                  <strong>{fmtTime(e.startTime)}</strong>
                  <span className="badge badge--red">
                    {e.peakSpeedKmh.toFixed(0)} km/h
                  </span>
                </div>
                <div className="meta">
                  {Math.max(
                    1,
                    Math.round(
                      (e.endTime.getTime() - e.startTime.getTime()) / 1000,
                    ),
                  )}
                  s · {(e.distanceKm * 1000).toFixed(0)} m
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
