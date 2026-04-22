import { useRouteStore } from "../store/useRouteStore";

export function Header() {
  const date = useRouteStore((s) => s.date);
  const availableDates = useRouteStore((s) => s.availableDates);
  const setDate = useRouteStore((s) => s.setDate);
  const threshold = useRouteStore((s) => s.thresholdKmh);
  const setThreshold = useRouteStore((s) => s.setThreshold);
  const loadStatus = useRouteStore((s) => s.loadStatus);
  const selectedTripId = useRouteStore((s) => s.selectedTripId);
  const selectTrip = useRouteStore((s) => s.selectTrip);

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
        {loadStatus === "loading" && <span>Loading…</span>}
        {loadStatus === "error" && <span className="status--err">Error</span>}
        {loadStatus === "ready" && <span className="status--ok">Ready</span>}
      </div>
    </header>
  );
}
