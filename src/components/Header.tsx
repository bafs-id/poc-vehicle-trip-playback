import { useShallow } from "zustand/react/shallow";
import { useRouteStore } from "../store/useRouteStore";

export function Header() {
  const {
    vehicles,
    selectedVehicleId,
    selectVehicle,
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
      vehicles: s.vehicles,
      selectedVehicleId: s.selectedVehicleId,
      selectVehicle: s.selectVehicle,
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

  const isLoading = loadState.status === "loading";

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-dot" /> Vehicle Route History
      </div>

      <div className="control">
        <label>Vehicle</label>
        <select
          value={selectedVehicleId ?? ""}
          onChange={(e) => {
            if (e.target.value) void selectVehicle(e.target.value);
          }}
          disabled={vehicles.length === 0 || isLoading}
        >
          {vehicles.length === 0 && <option value="">—</option>}
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </select>
      </div>

      <div className="control">
        <label>Date</label>
        <select
          value={date ?? ""}
          onChange={(e) => setDate(e.target.value || null)}
          disabled={availableDates.length === 0 || isLoading}
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
