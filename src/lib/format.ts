/** HH:MM:SS in the user's locale. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Locale date+time, used in map popups. */
export function formatDateTime(d: Date): string {
  return d.toLocaleString();
}

/** Duration in whole seconds (always at least 1s for non-zero spans). */
export function formatDurationSeconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

/** Speeding-event distance: meters when < 1 km, otherwise km with 2 decimals. */
export function formatEventDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `${(distanceKm * 1000).toFixed(0)} m`
    : `${distanceKm.toFixed(2)} km`;
}
