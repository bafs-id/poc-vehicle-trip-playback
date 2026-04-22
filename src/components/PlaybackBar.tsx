import { useShallow } from "zustand/react/shallow";
import { clsx } from "../lib/clsx";
import { PLAYBACK_RATES } from "../lib/constants";
import { useRouteStore } from "../store/useRouteStore";
import { useFilteredPoints } from "../store/selectors";

export function PlaybackBar() {
  const points = useFilteredPoints();
  const {
    isPlaying,
    togglePlay,
    playheadIndex,
    setPlayheadIndex,
    playbackRate,
    setPlaybackRate,
  } = useRouteStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      togglePlay: s.togglePlay,
      playheadIndex: s.playheadIndex,
      setPlayheadIndex: s.setPlayheadIndex,
      playbackRate: s.playbackRate,
      setPlaybackRate: s.setPlaybackRate,
    })),
  );

  const max = Math.max(0, points.length - 1);
  const current = points[Math.min(playheadIndex, max)];
  const speedNow = current?.speedKmh ?? 0;
  const disabled = points.length < 2;

  return (
    <footer className="playback">
      <button
        className="play-btn"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="time">
        {current ? current.timestamp.toLocaleTimeString() : "—"}
        <span className={clsx("speed", current?.isSpeeding && "speed--red")}>
          {speedNow.toFixed(0)} km/h
        </span>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(playheadIndex, max)}
        onChange={(e) => setPlayheadIndex(Number(e.target.value))}
        disabled={disabled}
      />

      <div className="rates">
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            className={clsx("rate", playbackRate === r && "active")}
            onClick={() => setPlaybackRate(r)}
          >
            {r}x
          </button>
        ))}
      </div>
    </footer>
  );
}
