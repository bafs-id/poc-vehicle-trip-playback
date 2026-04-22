import { create } from "zustand";
import type {
  FlyToTarget,
  LoadState,
  Point,
  RawPoint,
  SpeedingEvent,
  Trip,
  Vehicle,
} from "../types";
import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SPEED_THRESHOLD_KMH,
  MAP_FLY_TO_ZOOM,
  type PlaybackRate,
} from "../lib/constants";
import { toLocalDateString } from "../lib/date";
import { loadVehicleCsv, loadVehicleManifest } from "../lib/loadCsv";
import { processPoints } from "../lib/processPoints";
import { segmentTrips } from "../lib/segmentTrips";
import { buildSpeedingEvents } from "../lib/speedingEvents";

export type RouteState = {
  loadState: LoadState;
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  raw: RawPoint[];
  allPoints: Point[];
  trips: Trip[];
  speedingEvents: SpeedingEvent[];

  /** local-date string (YYYY-MM-DD) currently selected; null = all dates */
  date: string | null;
  availableDates: string[];
  thresholdKmh: number;

  isPlaying: boolean;
  playbackRate: PlaybackRate;
  /** index into the FILTERED point list */
  playheadIndex: number;

  selectedTripId: string | null;
  selectedEventId: string | null;

  /** monotonic counter — bumped to ask the map to re-fit bounds */
  fitBoundsToken: number;
  /** monotonic counter — bumped to ask the map to fly to `flyToTarget` */
  flyToToken: number;
  flyToTarget: FlyToTarget | null;
};

export type RouteActions = {
  loadData: () => Promise<void>;
  selectVehicle: (id: string) => Promise<void>;
  setDate: (d: string | null) => void;
  setThreshold: (n: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlayheadIndex: (i: number) => void;
  setPlaybackRate: (r: PlaybackRate) => void;
  selectTrip: (id: string | null) => void;
  selectEvent: (id: string | null) => void;
  requestFitBounds: () => void;
};

export type RouteStore = RouteState & RouteActions;

const BASE_URL = import.meta.env.BASE_URL;

/** Extract the vehicle id after BASE_URL, e.g. `/poc/vehicle-trip-placback/ZS-47` → `ZS-47`. */
export function readVehicleIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  const tail = path.startsWith(BASE_URL) ? path.slice(BASE_URL.length) : path;
  const id = tail.split("/")[0];
  return id || null;
}

function writeVehicleIdToUrl(id: string, opts: { replace: boolean }): void {
  if (typeof window === "undefined") return;
  const target = `${BASE_URL}${id}${window.location.search}${window.location.hash}`;
  if (target === window.location.pathname + window.location.search + window.location.hash) return;
  const fn = opts.replace ? "replaceState" : "pushState";
  window.history[fn](null, "", target);
}

export const useRouteStore = create<RouteStore>((set, get) => ({
  loadState: { status: "idle" },
  vehicles: [],
  selectedVehicleId: null,
  raw: [],
  allPoints: [],
  trips: [],
  speedingEvents: [],

  date: null,
  availableDates: [],
  thresholdKmh: DEFAULT_SPEED_THRESHOLD_KMH,

  isPlaying: false,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  playheadIndex: 0,

  selectedTripId: null,
  selectedEventId: null,
  fitBoundsToken: 0,
  flyToToken: 0,
  flyToTarget: null,

  loadData: async () => {
    // Guard against React 19 StrictMode double-invocation: skip if a load
    // is already in progress.
    if (get().loadState.status === "loading") return;
    set({ loadState: { status: "loading" } });
    try {
      const vehicles = await loadVehicleManifest();
      if (vehicles.length === 0) {
        set({
          loadState: {
            status: "error",
            message: "No vehicles found in public/vehicle_logs/",
          },
        });
        return;
      }
      set({ vehicles });
      const urlId = readVehicleIdFromUrl();
      const target =
        (urlId && vehicles.find((v) => v.id === urlId)) || vehicles[0];
      await loadVehicleData(target, set, get);
      writeVehicleIdToUrl(target.id, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loadState: { status: "error", message } });
    }
  },

  selectVehicle: async (id) => {
    const s = get();
    if (id === s.selectedVehicleId) return;
    const vehicle = s.vehicles.find((v) => v.id === id);
    if (!vehicle) return;
    set({ loadState: { status: "loading" } });
    try {
      await loadVehicleData(vehicle, set, get);
      writeVehicleIdToUrl(vehicle.id, { replace: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loadState: { status: "error", message } });
    }
  },

  setDate: (date) =>
    set((s) => ({
      date,
      playheadIndex: 0,
      selectedTripId: null,
      selectedEventId: null,
      fitBoundsToken: s.fitBoundsToken + 1,
    })),

  setThreshold: (n) => {
    const thresholdKmh = Number.isFinite(n)
      ? Math.max(1, n)
      : DEFAULT_SPEED_THRESHOLD_KMH;
    const points = processPoints(get().raw, thresholdKmh);
    set((s) => ({
      thresholdKmh,
      allPoints: points,
      trips: segmentTrips(points),
      speedingEvents: buildSpeedingEvents(points),
      selectedTripId: null,
      selectedEventId: null,
      fitBoundsToken: s.fitBoundsToken + 1,
    }));
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlayheadIndex: (i) => set({ playheadIndex: Math.max(0, Math.floor(i)) }),
  setPlaybackRate: (r) => set({ playbackRate: r }),

  selectTrip: (id) => {
    if (id === null) {
      set((s) => ({
        selectedTripId: null,
        selectedEventId: null,
        playheadIndex: 0,
        isPlaying: false,
        fitBoundsToken: s.fitBoundsToken + 1,
      }));
      return;
    }
    const trip = get().trips.find((t) => t.id === id);
    if (!trip) return;
    set((s) => ({
      selectedTripId: id,
      selectedEventId: null,
      date: toLocalDateString(trip.startTime),
      playheadIndex: 0,
      isPlaying: false,
      fitBoundsToken: s.fitBoundsToken + 1,
    }));
  },

  selectEvent: (id) => {
    if (id === null) {
      set({ selectedEventId: null });
      return;
    }
    set((s) => {
      const evt = s.speedingEvents.find((e) => e.id === id);
      if (!evt) return s;

      // Keep current trip selection only if the event lies inside it,
      // otherwise clear it so the event isn't filtered out.
      const currentTrip = findTrip(s.trips, s.selectedTripId);
      const keepTrip =
        currentTrip != null && tripContainsEvent(currentTrip, evt);
      const nextTripId = keepTrip ? s.selectedTripId : null;
      const nextDate = toLocalDateString(evt.startTime);

      // Compute the playhead position against the about-to-be-filtered list.
      const filtered = filterPointsRaw(
        s.allPoints,
        nextDate,
        keepTrip ? currentTrip : null,
      );
      const playIdx = Math.max(
        0,
        filtered.findIndex((p) => p.index >= evt.startIndex),
      );

      return {
        date: nextDate,
        selectedTripId: nextTripId,
        selectedEventId: id,
        playheadIndex: playIdx,
        isPlaying: false,
        flyToToken: s.flyToToken + 1,
        flyToTarget: {
          lat: evt.midLat,
          lng: evt.midLng,
          zoom: MAP_FLY_TO_ZOOM,
        },
      };
    });
  },

  requestFitBounds: () =>
    set((s) => ({ fitBoundsToken: s.fitBoundsToken + 1 })),
}));

// ---------- internal helpers ----------
// Exported so selectors.ts can reuse them; not part of the public API.

type Setter = (
  partial: Partial<RouteStore> | ((s: RouteStore) => Partial<RouteStore>),
) => void;
type Getter = () => RouteStore;

/** Run the full pipeline for a single vehicle and commit to the store. */
async function loadVehicleData(
  vehicle: Vehicle,
  set: Setter,
  get: Getter,
): Promise<void> {
  const raw = await loadVehicleCsv(vehicle.url);
  const points = processPoints(raw, get().thresholdKmh);
  const trips = segmentTrips(points);
  const events = buildSpeedingEvents(points);
  const dates = uniqueDates(raw);
  const initialDate = dates[dates.length - 1] ?? null;
  const lastTripOnDate = lastTripFor(trips, initialDate);
  set((s) => ({
    loadState: { status: "ready" },
    selectedVehicleId: vehicle.id,
    raw,
    allPoints: points,
    trips,
    speedingEvents: events,
    availableDates: dates,
    date: initialDate,
    selectedTripId: lastTripOnDate?.id ?? null,
    selectedEventId: null,
    playheadIndex: 0,
    isPlaying: false,
    fitBoundsToken: s.fitBoundsToken + 1,
  }));
}

export function findTrip(trips: Trip[], id: string | null): Trip | null {
  if (!id) return null;
  return trips.find((t) => t.id === id) ?? null;
}

export function tripContainsEvent(trip: Trip, evt: SpeedingEvent): boolean {
  return evt.startIndex >= trip.startIndex && evt.endIndex <= trip.endIndex;
}

export function tripOnDate(t: Trip, date: string | null): boolean {
  if (!date) return true;
  return (
    toLocalDateString(t.startTime) === date ||
    toLocalDateString(t.endTime) === date
  );
}

export function filterPointsRaw(
  points: Point[],
  date: string | null,
  trip: Trip | null,
): Point[] {
  return points.filter((p) => {
    if (date && toLocalDateString(p.timestamp) !== date) return false;
    if (trip && (p.index < trip.startIndex || p.index > trip.endIndex)) {
      return false;
    }
    return true;
  });
}

function uniqueDates(raw: RawPoint[]): string[] {
  const set = new Set<string>();
  for (const p of raw) set.add(toLocalDateString(p.timestamp));
  return [...set].sort();
}

function lastTripFor(trips: Trip[], date: string | null): Trip | null {
  const onDate = date ? trips.filter((t) => tripOnDate(t, date)) : trips;
  return onDate[onDate.length - 1] ?? null;
}
