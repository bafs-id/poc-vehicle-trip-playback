import { useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RouteMap } from "./components/RouteMap";
import { PlaybackBar } from "./components/PlaybackBar";
import { useRouteStore } from "./store/useRouteStore";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import "./App.css";

function App() {
  const loadData = useRouteStore((s) => s.loadData);
  const loadStatus = useRouteStore((s) => s.loadStatus);
  const errorMessage = useRouteStore((s) => s.errorMessage);

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePlaybackLoop();

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Sidebar />
        <div className="map-wrap">
          {loadStatus === "error" && (
            <div className="overlay overlay--err">
              Failed to load: {errorMessage}
            </div>
          )}
          {loadStatus === "loading" && (
            <div className="overlay">Loading vehicle history…</div>
          )}
          <RouteMap />
        </div>
      </main>
      <PlaybackBar />
    </div>
  );
}

export default App;
