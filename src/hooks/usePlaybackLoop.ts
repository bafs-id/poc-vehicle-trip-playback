import { useEffect, useRef } from "react";
import { useRouteStore } from "../store/useRouteStore";
import { useFilteredPoints } from "../store/selectors";

/**
 * Drives the playhead from a virtual playback clock that respects gaps in
 * the data: each animation frame the clock advances by `realDelta * rate`
 * and the playhead jumps to the latest point whose timestamp ≤ the clock.
 *
 * The loop re-anchors whenever `points` identity changes (e.g. date or trip
 * selection) and pauses automatically on reaching the last point.
 *
 * `playheadIndex` is intentionally NOT a dependency of the effect — we read
 * the latest value via `getPlayheadIndex` to avoid restarting the rAF loop
 * on every advance.
 */
export function usePlaybackLoop() {
  const isPlaying = useRouteStore((s) => s.isPlaying);
  const playbackRate = useRouteStore((s) => s.playbackRate);
  const playheadIndex = useRouteStore((s) => s.playheadIndex);
  const setPlayheadIndex = useRouteStore((s) => s.setPlayheadIndex);
  const pause = useRouteStore((s) => s.pause);
  const points = useFilteredPoints();

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const virtualMsRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || points.length < 2) {
      cancelLoop(rafRef, lastTickRef);
      return;
    }

    // Anchor the virtual clock at the playhead's timestamp.
    const anchor = points[Math.min(playheadIndex, points.length - 1)];
    virtualMsRef.current = anchor.timestamp.getTime();

    const tick = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const realDelta = now - lastTickRef.current;
      lastTickRef.current = now;
      virtualMsRef.current += realDelta * playbackRate;

      // Advance to the last point with timestamp ≤ virtual clock.
      let i = getPlayheadIndex();
      while (
        i + 1 < points.length &&
        points[i + 1].timestamp.getTime() <= virtualMsRef.current
      ) {
        i++;
      }
      if (i !== getPlayheadIndex()) setPlayheadIndex(i);

      if (i >= points.length - 1) {
        pause();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelLoop(rafRef, lastTickRef);
    // playheadIndex intentionally NOT in deps — see JSDoc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackRate, points]);
}

function cancelLoop(
  rafRef: React.RefObject<number | null>,
  lastTickRef: React.RefObject<number | null>,
) {
  if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  rafRef.current = null;
  lastTickRef.current = null;
}

function getPlayheadIndex(): number {
  return useRouteStore.getState().playheadIndex;
}
