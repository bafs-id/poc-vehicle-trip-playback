import { useShallow } from "zustand/react/shallow";
import { toLocalDateString } from "../lib/date";
import {
  filterPointsRaw,
  findTrip,
  tripOnDate,
  useRouteStore,
} from "./useRouteStore";

/** Points currently shown on the map: by date, narrowed to the selected trip if any. */
export function useFilteredPoints() {
  return useRouteStore(
    useShallow((s) =>
      filterPointsRaw(s.allPoints, s.date, findTrip(s.trips, s.selectedTripId)),
    ),
  );
}

/** All trips for the selected date. */
export function useVisibleTrips() {
  return useRouteStore(
    useShallow((s) => s.trips.filter((t) => tripOnDate(t, s.date))),
  );
}

/** Speeding events for the selected date, narrowed to the selected trip if any. */
export function useVisibleSpeedingEvents() {
  return useRouteStore(
    useShallow((s) => {
      const trip = findTrip(s.trips, s.selectedTripId);
      return s.speedingEvents.filter((e) => {
        if (s.date && toLocalDateString(e.startTime) !== s.date) return false;
        if (
          trip &&
          (e.startIndex < trip.startIndex || e.endIndex > trip.endIndex)
        ) {
          return false;
        }
        return true;
      });
    }),
  );
}
