import { useFilteredPoints, useRouteStore } from "../store/useRouteStore";

const RATES = [1, 2, 4, 8, 16];

export function PlaybackBar() {
  const points = useFilteredPoints();
  const isPlaying = useRouteStore((s) => s.isPlaying);
  const togglePlay = useRouteStore((s) => s.togglePlay);
  const playheadIndex = useRouteStore((s) => s.playheadIndex);
  const setPlayheadIndex = useRouteStore((s) => s.setPlayheadIndex);
  const playbackRate = useRouteStore((s) => s.playbackRate);
  const setPlaybackRate = useRouteStore((s) => s.setPlaybackRate);

  const max = Math.max(0, points.length - 1);
  const cur = points[Math.min(playheadIndex, max)];
  const speedNow = cur?.speedKmh ?? 0;

  return (
    <footer className="playback">
      <button
        className="play-btn"
        onClick={togglePlay}
        disabled={points.length < 2}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="time">
        {cur ? cur.timestamp.toLocaleTimeString() : "—"}
        <span className={"speed " + (cur?.isSpeeding ? "speed--red" : "")}>
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
        disabled={points.length < 2}
      />

      <div className="rates">
        {RATES.map((r) => (
          <button
            key={r}
            className={"rate " + (playbackRate === r ? "active" : "")}
            onClick={() => setPlaybackRate(r)}
          >
            {r}x
          </button>
        ))}
      </div>
    </footer>
  );
}
