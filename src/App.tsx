import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RouteMap } from "./components/RouteMap";
import { PlaybackBar } from "./components/PlaybackBar";
import { readVehicleIdFromUrl, useRouteStore } from "./store/useRouteStore";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import "./App.css";

function App() {
  const { loadState, loadData, selectVehicle } = useRouteStore(
    useShallow((s) => ({
      loadState: s.loadState,
      loadData: s.loadData,
      selectVehicle: s.selectVehicle,
    })),
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onPop = () => {
      const id = readVehicleIdFromUrl();
      if (id) selectVehicle(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [selectVehicle]);

  usePlaybackLoop();

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Sidebar />
        <div className="map-wrap">
          {loadState.status === "error" && (
            <div className="overlay overlay--err">
              Failed to load: {loadState.message}
            </div>
          )}
          {loadState.status === "loading" && (
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
