import { useState } from "react";
import { EmbeddingCompareView } from "./components/EmbeddingCompareView";
import { MapView } from "./components/MapView";
import { EmbeddingView } from "./components/EmbeddingView";
import { TrajectoryAnalysisPanel } from "./components/TrajectoryAnalysisPanel";
import { VizToolbar } from "./components/VizToolbar";
import { TrajectoryPlaybackEngine } from "./components/TrajectoryPlaybackEngine";
import { useAppStore } from "./store/useAppStore";
import givaMark from "./assets/giva-mark.svg";

export default function App() {
  const { viewMode, compareMode } = useAppStore();
  const [leftPanelMode, setLeftPanelMode] = useState<"viz" | "algo">("algo");

  return (
    <div className="app-shell">
      <div className="left-dock">
        <div className="brand-block">
          <div className="brand-logo-placeholder" aria-hidden="true">
            <img src={givaMark} alt="" className="brand-logo-image" />
          </div>
          <div className="brand-meta">
            <div className="brand-name">轨迹表征可视化</div>
            <div className="brand-full">Trajectory Representation Visual Analytics</div>
          </div>
        </div>
        <div className="panel-mode-switch" role="tablist" aria-label="左侧模块切换">
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelMode === "algo"}
            className={leftPanelMode === "algo" ? "active" : ""}
            onClick={() => setLeftPanelMode("algo")}
          >
            算法模块
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelMode === "viz"}
            className={leftPanelMode === "viz" ? "active" : ""}
            onClick={() => setLeftPanelMode("viz")}
          >
            可视化模块
          </button>
        </div>
        {leftPanelMode === "algo" && <TrajectoryAnalysisPanel />}
        {leftPanelMode === "viz" && <VizToolbar />}
      </div>
      <TrajectoryPlaybackEngine />
      <div className={`main-area ${viewMode}`}>
        {viewMode === "dual" && (
          <>
            {compareMode ? <EmbeddingCompareView /> : <EmbeddingView />}
            <MapView />
          </>
        )}
        {viewMode === "single" && <MapView />}
      </div>
    </div>
  );
}
