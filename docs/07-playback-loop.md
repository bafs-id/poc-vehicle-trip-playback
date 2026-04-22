# 07 — Playback loop hook

## Goal

Drive the playhead from a `requestAnimationFrame` loop with a **virtual clock** that respects the data's real timestamps. Pressing play at 4× makes the journey replay at 4× wall-clock speed; long gaps in the data (parked car, lost signal) are skipped naturally because the playhead chases timestamps, not array indices.

## File to create

### `src/hooks/usePlaybackLoop.ts`

```ts
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
```

## Walk-through

### The virtual clock

A naïve "advance one index per N ms" loop ignores the real time-axis: a 30-second sampling gap would still advance one index in N ms, making the playhead crawl forward as if no time passed. We want **the playhead to jump across data gaps in proportion to how much wall time the gap represents**.

Solution:

1. On (re)start, set `virtualMsRef = points[playheadIndex].timestamp.getTime()`.
2. Every frame, add `(now - lastNow) * playbackRate` to it.
3. Advance the playhead to the last point whose timestamp ≤ `virtualMs`. (Inner `while` loop — could skip many points in one frame if there's a gap.)

That last point is, in effect, "the latest sample we'd have seen if we'd been playing at this rate continuously". Gaps disappear with no special-case code.

### Why `playheadIndex` is **not** in the effect deps

The effect already reads `playheadIndex` at the top (to anchor the virtual clock on (re)start). But you do _not_ want the effect to **re-run every frame** as the playhead advances — that would tear down and rebuild the rAF loop ~60 times per second, missing frames.

The trick:

- Read `playheadIndex` _once_ on (re)start to anchor.
- Inside `tick`, read the **latest** value via `useRouteStore.getState().playheadIndex` — bypasses React, no subscription, no re-render trigger.
- Suppress the eslint warning with the comment, because the hooks lint rule can't tell this is intentional.

The effect therefore re-runs only when `isPlaying`, `playbackRate`, or `points` (identity) actually change.

### Auto-pause at the end

When `i >= points.length - 1` we call `pause()`. Crucially we **return without scheduling another rAF** — otherwise the next frame would try to advance past the end.

### Cleanup

`cancelLoop` cancels any pending rAF and clears `lastTickRef` so a future restart re-anchors `lastTickRef` cleanly on the very first frame (`if (lastTickRef.current == null) lastTickRef.current = now;`).

## Pitfalls

> **The eslint suppression comment must stay.** Without it, the rule will yell on every save and a future "fix" might add `playheadIndex` to the deps — silently breaking the loop's frame rate.

> **Don't read `playheadIndex` from the closure inside `tick`.** The closure captures the value at effect-run time. Use `getPlayheadIndex()` for the live value.

> **`points.length < 2` short-circuit.** If filters narrow the list to ≤1 point, there's nothing to play and `points[1].timestamp` would crash. The early return is what lets the play button stay enabled-but-harmless on tiny datasets — actually the play button is disabled in `PlaybackBar` for that case (next phase), so this is belt-and-braces.

> **`useEffect` cleanup runs _before_ the next effect run.** When the user clicks "play" → "pause" → "play" → "pause" rapidly, each pause invocation triggers the cleanup. Without the `cancelLoop`, leaked rAFs would pile up.

## Checkpoint

```bash
npx tsc --noEmit
```

Clean. (No runtime test — the hook depends on `useFilteredPoints`, which depends on the store, which is wired up at app level in phase 10. We'll see playback live then.)

➡️ Continue to [08-components-header-sidebar-playback.md](08-components-header-sidebar-playback.md).
