import Papa from "papaparse";
import type { RawPoint } from "../types";

type Row = {
  Latitude: string;
  Longitude: string;
  CreatedDate: string;
};

export async function loadVehicleCsv(
  url = "/vehicle_locations.csv",
): Promise<RawPoint[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();

  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const points: RawPoint[] = [];
  for (const row of parsed.data) {
    const lat = Number(row.Latitude);
    const lng = Number(row.Longitude);
    const timestamp = parseTimestamp(row.CreatedDate);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!timestamp || Number.isNaN(timestamp.getTime())) continue;
    points.push({ lat, lng, timestamp });
  }

  points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return points;
}

/**
 * The CSV uses ".NNNNNNN" sub-second precision plus a "+07:00" offset, e.g.
 * "2026-04-22 07:00:00.0412456 +07:00". Date can't parse that natively, so
 * normalize it to ISO 8601 first.
 */
function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // "YYYY-MM-DD HH:MM:SS.fffffff +HH:MM"
  const m = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2}:?\d{2}|Z)?$/,
  );
  if (!m) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, date, time, frac, tz] = m;
  const ms = frac ? frac.slice(0, 3).padEnd(3, "0") : "000";
  const offset = tz
    ? tz === "Z"
      ? "Z"
      : tz.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")
    : "Z";
  return new Date(`${date}T${time}.${ms}${offset}`);
}
