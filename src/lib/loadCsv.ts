import Papa from "papaparse";
import type { RawPoint, Vehicle } from "../types";

type Row = {
  Latitude: string;
  Longitude: string;
  CreatedDate: string;
};

const VEHICLE_MANIFEST_URL = `${import.meta.env.BASE_URL}vehicle_logs/index.json`;

/** Fetch the manifest of vehicles produced by the vite-vehicle-manifest plugin. */
export async function loadVehicleManifest(): Promise<Vehicle[]> {
  const res = await fetch(VEHICLE_MANIFEST_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch vehicle manifest: ${res.status}`);
  }
  const data = (await res.json()) as { vehicles?: Vehicle[] };
  return data.vehicles ?? [];
}

/** Fetch a vehicle CSV and return parsed points sorted by timestamp. */
export async function loadVehicleCsv(url: string): Promise<RawPoint[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  return parseVehicleCsv(text);
}

/** Parse the vehicle CSV text into points sorted by timestamp. */
export function parseVehicleCsv(text: string): RawPoint[] {
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row})`);
  }

  const points: RawPoint[] = [];
  for (const row of parsed.data) {
    const lat = Number(row.Latitude);
    const lng = Number(row.Longitude);
    const timestamp = parseTimestamp(row.CreatedDate);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!timestamp) continue;
    points.push({ lat, lng, timestamp });
  }

  points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return points;
}

const TIMESTAMP_RE =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2}:?\d{2}|Z)?$/;

/**
 * The CSV uses ".NNNNNNN" sub-second precision plus a "+07:00" offset, e.g.
 * "2026-04-22 07:00:00.0412456 +07:00". `Date` can't parse that natively, so
 * normalize it to ISO 8601 first. Sub-millisecond precision is dropped.
 */
function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(TIMESTAMP_RE);
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
  const d = new Date(`${date}T${time}.${ms}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
