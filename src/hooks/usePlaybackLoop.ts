import { useEffect, useRef } from "react";
import { useRouteStore } from "../store/useRouteStore";
import { useFilteredPoints } from "../store/useRouteStore";

/**
 * Drives the playhead based on real timestamps so playback respects gaps in
 * the data: rate * realElapsedMs is added to a virtual playback clock and
 * the playhead advances to the latest point whose timestamp <= clock.
 *
 * When the playhead reaches the end the loop pauses.
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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
      return;
    }

    // anchor virtual clock at the playhead's timestamp
    const anchor = points[Math.min(playheadIndex, points.length - 1)];
    virtualMsRef.current = anchor.timestamp.getTime();

    const tick = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const realDelta = now - lastTickRef.current;
      lastTickRef.current = now;
      virtualMsRef.current += realDelta * playbackRate;

      // advance to the last point with timestamp <= virtual clock
      let i = playheadIndexLatest();
      while (
        i + 1 < points.length &&
        points[i + 1].timestamp.getTime() <= virtualMsRef.current
      ) {
        i++;
      }
      if (i !== playheadIndexLatest()) setPlayheadIndex(i);

      if (i >= points.length - 1) {
        pause();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
    // re-run when these change; playheadIndex intentionally NOT in deps to
    // avoid restarting the loop on every advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackRate, points]);
}

function playheadIndexLatest(): number {
  return useRouteStore.getState().playheadIndex;
}
