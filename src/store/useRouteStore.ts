import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  LoadStatus,
  Point,
  RawPoint,
  SpeedingEvent,
  Trip,
} from "../types";
import { loadVehicleCsv } from "../lib/loadCsv";
import { processPoints } from "../lib/processPoints";
import { segmentTrips } from "../lib/segmentTrips";
import { buildSpeedingEvents } from "../lib/speedingEvents";

type State = {
  loadStatus: LoadStatus;
  errorMessage: string | null;
  raw: RawPoint[];
  allPoints: Point[];
  trips: Trip[];
  speedingEvents: SpeedingEvent[];

  /** local-date string (YYYY-MM-DD) currently selected; null = all dates */
  date: string | null;
  availableDates: string[];
  thresholdKmh: number;

  isPlaying: boolean;
  playbackRate: number;
  playheadIndex: number; // index into the FILTERED point list

  selectedTripId: string | null;
  selectedEventId: string | null;
  /** bumped whenever map should re-fit bounds */
  fitBoundsToken: number;
  /** bumped when map should fly to a specific lat/lng */
  flyToToken: number;
  flyToTarget: { lat: number; lng: number; zoom?: number } | null;
};

type Actions = {
  loadData: () => Promise<void>;
  setDate: (d: string | null) => void;
  setThreshold: (n: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlayheadIndex: (i: number) => void;
  setPlaybackRate: (r: number) => void;
  selectTrip: (id: string | null) => void;
  selectEvent: (id: string | null) => void;
  requestFitBounds: () => void;
};

const DEFAULT_THRESHOLD = 50;

export const useRouteStore = create<State & Actions>((set, get) => ({
  loadStatus: "idle",
  errorMessage: null,
  raw: [],
  allPoints: [],
  trips: [],
  speedingEvents: [],

  date: null,
  availableDates: [],
  thresholdKmh: DEFAULT_THRESHOLD,

  isPlaying: false,
  playbackRate: 4,
  playheadIndex: 0,

  selectedTripId: null,
  selectedEventId: null,
  fitBoundsToken: 0,
  flyToToken: 0,
  flyToTarget: null,

  loadData: async () => {
    set({ loadStatus: "loading", errorMessage: null });
    try {
      const raw = await loadVehicleCsv();
      const points = processPoints(raw, get().thresholdKmh);
      const trips = segmentTrips(points);
      const events = buildSpeedingEvents(points);
      const dates = uniqueDates(raw);
      const initialDate = dates[dates.length - 1] ?? null;
      const tripsOnInitialDate = initialDate
        ? trips.filter((t) => tripOnDate(t, initialDate))
        : trips;
      const lastTrip =
        tripsOnInitialDate[tripsOnInitialDate.length - 1] ?? null;
      set({
        loadStatus: "ready",
        raw,
        allPoints: points,
        trips,
        speedingEvents: events,
        availableDates: dates,
        date: initialDate,
        selectedTripId: lastTrip?.id ?? null,
        playheadIndex: 0,
        fitBoundsToken: get().fitBoundsToken + 1,
      });
    } catch (err) {
      set({
        loadStatus: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
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
      : DEFAULT_THRESHOLD;
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
        playheadIndex: 0,
        isPlaying: false,
        fitBoundsToken: s.fitBoundsToken + 1,
      }));
      return;
    }
    const trip = get().trips.find((t) => t.id === id);
    if (!trip) return;
    const dateStr = toLocalDateString(trip.startTime);
    set((s) => ({
      selectedTripId: id,
      selectedEventId: null,
      date: dateStr,
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
    const evt = get().speedingEvents.find((e) => e.id === id);
    if (!evt) return;
    // ensure the event's day is selected; keep current trip selection if the
    // event lies inside it, otherwise clear it so the event isn't hidden.
    const dateStr = toLocalDateString(evt.startTime);
    const currentTrip = getSelectedTrip(get());
    const tripCovers =
      currentTrip != null &&
      evt.startIndex >= currentTrip.startIndex &&
      evt.endIndex <= currentTrip.endIndex;
    set({
      date: dateStr,
      selectedTripId: tripCovers ? get().selectedTripId : null,
    });
    const refreshed = computeFilteredPoints(get());
    const playIdx = Math.max(
      0,
      refreshed.findIndex((p) => p.index >= evt.startIndex),
    );
    set((s) => ({
      selectedEventId: id,
      playheadIndex: playIdx,
      isPlaying: false,
      flyToToken: s.flyToToken + 1,
      flyToTarget: { lat: evt.midLat, lng: evt.midLng, zoom: 17 },
    }));
  },

  requestFitBounds: () =>
    set((s) => ({ fitBoundsToken: s.fitBoundsToken + 1 })),
}));

// ---------- selectors ----------

/** Points currently shown on the map: by date, narrowed to selected trip if any. */
export function useFilteredPoints() {
  return useRouteStore(
    useShallow((s) => filterPoints(s.allPoints, s.date, getSelectedTrip(s))),
  );
}

/** All trips for the selected date (no time-range filter). */
export function useVisibleTrips() {
  return useRouteStore(
    useShallow((s) => s.trips.filter((t) => tripOnDate(t, s.date))),
  );
}

/** Speeding events for the selected date, narrowed to selected trip if any. */
export function useVisibleSpeedingEvents() {
  return useRouteStore(
    useShallow((s) => {
      const trip = getSelectedTrip(s);
      return s.speedingEvents.filter((e) => {
        if (s.date && toLocalDateString(e.startTime) !== s.date) return false;
        if (
          trip &&
          (e.startIndex < trip.startIndex || e.endIndex > trip.endIndex)
        )
          return false;
        return true;
      });
    }),
  );
}

// ---------- helpers ----------

function getSelectedTrip(s: State): Trip | null {
  if (!s.selectedTripId) return null;
  return s.trips.find((t) => t.id === s.selectedTripId) ?? null;
}

function computeFilteredPoints(s: State): Point[] {
  return filterPoints(s.allPoints, s.date, getSelectedTrip(s));
}

export function filterPoints(
  points: Point[],
  date: string | null,
  trip: Trip | null,
): Point[] {
  return points.filter((p) => {
    if (date && toLocalDateString(p.timestamp) !== date) return false;
    if (trip && (p.index < trip.startIndex || p.index > trip.endIndex))
      return false;
    return true;
  });
}

function tripOnDate(t: Trip, date: string | null): boolean {
  if (!date) return true;
  return (
    toLocalDateString(t.startTime) === date ||
    toLocalDateString(t.endTime) === date
  );
}

function uniqueDates(raw: RawPoint[]): string[] {
  const set = new Set<string>();
  for (const p of raw) set.add(toLocalDateString(p.timestamp));
  return [...set].sort();
}

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
