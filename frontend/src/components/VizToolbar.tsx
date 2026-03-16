import { PaletteDropdown } from "./PaletteDropdown";
import { paletteOptions, getFeatureLabelValue } from "../utils/colors";
import type { NeighborItem } from "../types";
import { useAppStore, type BaiduTheme, type HighlightMode } from "../store/useAppStore";

const BAIDU_THEME_OPTIONS: Array<{ value: BaiduTheme; label: string }> = [
  { value: "normal", label: "普通" },
  { value: "dark", label: "深色" },
];

const HIGHLIGHT_MODE_OPTIONS: Array<{ value: HighlightMode; label: string }> = [
  { value: "click", label: "点击高亮" },
  { value: "hover", label: "悬浮高亮" },
];

export function VizToolbar() {
  const {
    viewMode,
    setViewMode,
    mapIs3d,
    setMapIs3d,
    baiduTheme,
    setBaiduTheme,
    topK,
    setTopK,
    activeLabelField,
    setActiveLabelField,
    labelFields,
    compareMode,
    setCompareMode,
    paletteId,
    setPaletteId,
    embeddingTrajectoryEnabled,
    setEmbeddingTrajectoryEnabled,
    sequenceSpeed,
    setSequenceSpeed,
    highlightMode,
    setHighlightMode,
    data,
    selectedId,
    similarIds,
    hoverPreviewId,
    hoverPreviewSimilarIds,
    labelColorMap,
    clearSelection,
    setSelectedId,
    mapLayerVisibility,
    setMapLayerVisibility,
    poiVizMode,
    setPoiVizMode,
    poiShowLabels,
    setPoiShowLabels,
    trajPoiCategoryField,
    trajTimeline,
    trajPlayhead,
    trajIsPlaying,
    trajPlaybackSpeed,
    setTrajPlayhead,
    setTrajIsPlaying,
    setTrajPlaybackSpeed,
  } = useAppStore();
  const hasBaiduAk = Boolean(import.meta.env.VITE_BAIDU_AK);
  const hasPoiTopCategory = labelFields.some((item) => item.field === "poi_top_category");
  const timelineLen = trajTimeline.length;
  const activeId = hoverPreviewId ?? selectedId;
  const activeSimilar = hoverPreviewId ? hoverPreviewSimilarIds : similarIds;

  const scoreById = (() => {
    const map = new Map<string, number>();
    if (!data || !activeId) return map;
    const feature = data.features.find((f) => f.properties.id === activeId);
    const neighbors = feature?.properties?.neighbors as NeighborItem[] | string[] | undefined;
    if (!Array.isArray(neighbors)) return map;
    neighbors.forEach((n: any) => {
      if (!n || typeof n === "string") return;
      const id = String(n.id ?? "");
      const score = Number(n.score);
      if (!id || !Number.isFinite(score)) return;
      map.set(id, score);
    });
    return map;
  })();

  const similarItems = (() => {
    if (!data || activeSimilar.length === 0) return [];
    const byId = new Map<string, any>();
    data.features.forEach((f) => byId.set(String(f.properties.id), f));
    return activeSimilar
      .map((id) => {
        const feature = byId.get(id);
        if (!feature) return null;
        const props = feature.properties ?? {};
        const label = getFeatureLabelValue(props as any, activeLabelField);
        const metric = Number(props.metric ?? NaN);
        const cluster = props.cluster_label ?? props.cluster_id ?? "-";
        const score = scoreById.get(id) ?? null;
        const color = labelColorMap[label] ?? "#3a4b6f";
        return {
          id,
          label,
          metric: Number.isFinite(metric) ? metric : null,
          cluster: String(cluster),
          score: typeof score === "number" ? score : null,
          color,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      label: string;
      metric: number | null;
      cluster: string;
      score: number | null;
      color: string;
    }>;
  })();

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return (
    <aside className="panel viz-panel">
      <div className="panel-header">
        <div className="brand">可视化模块</div>
      </div>

      <div className="panel-section">
        <div className="section-title">视图布局</div>
        <div className="segmented">
          <button type="button" className={viewMode === "dual" ? "active" : ""} onClick={() => setViewMode("dual")}>
            ◫ 双视图
          </button>
          <button
            type="button"
            className={viewMode === "single" ? "active" : ""}
            onClick={() => setViewMode("single")}
          >
            ◧ 单视图
          </button>
        </div>
        <button
          type="button"
          className={`btn ${compareMode ? "active-like" : "ghost"}`}
          onClick={() => setCompareMode(!compareMode)}
        >
          ⇵ 向量上下对比
        </button>
      </div>

      <div className="panel-section">
        <div className="section-title">交互控制</div>
        <label className="control-label">高亮模式</label>
        <div className="segmented">
          {HIGHLIGHT_MODE_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={highlightMode === item.value ? "active" : ""}
              onClick={() => setHighlightMode(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="control-label">相似数量 TopK</label>
        <div className="slider-row">
          <input type="range" min={5} max={50} step={1} value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
          <span className="badge">{topK}</span>
        </div>
        <button
          type="button"
          className={`btn ${embeddingTrajectoryEnabled ? "" : "ghost"}`}
          onClick={() => setEmbeddingTrajectoryEnabled(!embeddingTrajectoryEnabled)}
        >
          ✦ 轨迹动画 {embeddingTrajectoryEnabled ? "开" : "关"}
        </button>
        <label className="control-label">动画速度</label>
        <div className="slider-row">
          <input
            type="range"
            min={0.05}
            max={0.8}
            step={0.01}
            value={sequenceSpeed}
            onChange={(e) => setSequenceSpeed(clamp(Number(e.target.value), 0.05, 0.8))}
            disabled={!activeId}
          />
          <span className="badge">{sequenceSpeed.toFixed(2)}</span>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-title">轨迹播放</div>
        <label className="control-label">
          播放速度（点/秒）
          <input
            className="text-input"
            type="number"
            min={0.2}
            max={8}
            step={0.2}
            value={trajPlaybackSpeed}
            onChange={(e) => setTrajPlaybackSpeed(Number(e.target.value))}
            disabled={timelineLen <= 1}
          />
        </label>
        <div className="slider-row">
          <input
            type="range"
            min={0}
            max={Math.max(0, timelineLen - 1)}
            step={1}
            value={Math.min(trajPlayhead, Math.max(0, timelineLen - 1))}
            onChange={(e) => setTrajPlayhead(Number(e.target.value))}
            disabled={timelineLen <= 1}
          />
          <span className="badge">{timelineLen <= 1 ? "-" : `${trajPlayhead + 1}/${timelineLen}`}</span>
        </div>
        <div className="segmented compact">
          <button type="button" className={trajIsPlaying ? "active" : ""} onClick={() => setTrajIsPlaying(!trajIsPlaying)} disabled={timelineLen <= 1}>
            {trajIsPlaying ? "暂停" : "播放"}
          </button>
          <button type="button" onClick={() => setTrajPlayhead(0)} disabled={timelineLen <= 1}>
            回到起点
          </button>
        </div>
      </div>

      <div className="panel-section">
        <div className="section-title">选中与相似</div>
        {!activeId && <div className="hint">在地图或特征空间中点击/悬浮一个点以查看相似链。</div>}
        {activeId && (
          <div className="traj-selected">
            <span
              className="traj-swatch"
              style={{ backgroundColor: (() => {
                const f = data?.features.find((x) => x.properties.id === activeId);
                const label = f ? getFeatureLabelValue(f.properties as any, activeLabelField) : "-";
                return labelColorMap[label] ?? "#3a4b6f";
              })() }}
              aria-hidden="true"
            />
            <div className="traj-selected-meta">
              <div className="traj-selected-title" title={String(activeId)}>
                {(() => {
                  const f = data?.features.find((x) => x.properties.id === activeId);
                  if (!f) return "-";
                  return getFeatureLabelValue(f.properties as any, activeLabelField);
                })()}
              </div>
              <div className="traj-selected-sub">{activeId}</div>
            </div>
            <div className="traj-selected-actions">
              <button type="button" className="chip danger" onClick={clearSelection}>
                清除
              </button>
            </div>
          </div>
        )}

        {activeId && (
          <div className="traj-list" role="list">
            {similarItems.length === 0 && <div className="hint">暂无相似结果。</div>}
            {similarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="traj-item"
                role="listitem"
                onClick={() => void setSelectedId(item.id, "embedding-click")}
                title={item.id}
              >
                <span className="traj-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="traj-item-main">
                  <span className="traj-item-title" title={item.label}>
                    {item.label || "-"}
                  </span>
                  <span className="traj-item-sub">
                    {item.cluster} · metric {item.metric ?? "-"}
                    {typeof item.score === "number" ? ` · score ${item.score.toFixed(3)}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel-section">
        <div className="section-title">标签与配色</div>
        <label className="control-label">标签字段</label>
        <select className="select" value={activeLabelField} onChange={(e) => setActiveLabelField(e.target.value)}>
          {labelFields.map((item) => (
            <option key={item.field} value={item.field}>
              {item.label}
            </option>
          ))}
          {labelFields.length === 0 && <option value="info">info</option>}
        </select>
        {hasPoiTopCategory && activeLabelField !== "poi_top_category" && (
          <button type="button" className="btn ghost" onClick={() => setActiveLabelField("poi_top_category")}>
            按 POI 主类别着色（poi_top_category）
          </button>
        )}
        <label className="control-label">配色方案</label>
        <PaletteDropdown
          value={paletteId}
          options={paletteOptions}
          onChange={setPaletteId}
        />
      </div>

      <div className="panel-section">
        <div className="section-title">POI 图层</div>
        <div className="hint">POI 会按字段 {trajPoiCategoryField || "category"} 着色。</div>
        <div className="segmented compact">
          <button type="button" className={poiVizMode === "off" ? "active" : ""} onClick={() => setPoiVizMode("off")}>
            关闭
          </button>
          <button
            type="button"
            className={poiVizMode === "nearby" ? "active" : ""}
            onClick={() => setPoiVizMode("nearby")}
          >
            半径内
          </button>
          <button type="button" className={poiVizMode === "all" ? "active" : ""} onClick={() => setPoiVizMode("all")}>
            全部
          </button>
        </div>
        <label className="toggle-chip" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={poiShowLabels} onChange={(e) => setPoiShowLabels(e.target.checked)} />
          显示 POI 标签（建议在“半径内”使用）
        </label>
      </div>

      <div className="panel-section">
        <div className="section-title">地图控制</div>
        {!hasBaiduAk && <div className="hint">未配置百度 AK，地图不可用</div>}
        <label className="control-label">底图风格</label>
        <select className="select" value={baiduTheme} onChange={(e) => setBaiduTheme(e.target.value as BaiduTheme)}>
          {BAIDU_THEME_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="segmented compact">
          <button type="button" className={!mapIs3d ? "active" : ""} onClick={() => setMapIs3d(false)}>
            ⊞ 2D
          </button>
          <button type="button" className={mapIs3d ? "active" : ""} onClick={() => setMapIs3d(true)}>
            ◬ 3D
          </button>
        </div>
        <div className="inline-toggles">
          <label className="toggle-chip">
            <input
              type="checkbox"
              checked={mapLayerVisibility.basemap}
              onChange={(e) => setMapLayerVisibility({ basemap: e.target.checked })}
            />
            底图
          </label>
          <label className="toggle-chip">
            <input
              type="checkbox"
              checked={mapLayerVisibility.overlay}
              onChange={(e) => setMapLayerVisibility({ overlay: e.target.checked })}
            />
            数据层
          </label>
        </div>
      </div>
    </aside>
  );
}
