import { useState } from "react";
import type { FeatureCollection } from "../types";
import {
  useAppStore,
  type ClusteringMethod,
  type DimensionMethod,
  type SimilarityMethod,
} from "../store/useAppStore";

export function TrajectoryAnalysisPanel() {
  const {
    isLoading,
    error,
    uploadPoiGeoJSON,
    uploadTrajectoryGeoJSON,
    runTrajectoryAnalysis,
    poiDatasetId,
    poiCount,
    trajDatasetId,
    trajPointCount,
    trajRadiusM,
    setTrajRadiusM,
    trajVectorDim,
    setTrajVectorDim,
    trajPoiCategoryField,
    setTrajPoiCategoryField,
    trajCoordSystem,
    setTrajCoordSystem,
    analysisProgress,
    analysisStage,
    analysisStatus,
    dimensionMethod,
    setDimensionMethod,
    clusteringMethod,
    setClusteringMethod,
    similarityMethod,
    setSimilarityMethod,
    dimensionComponents,
    setDimensionComponents,
    dimensionNeighbors,
    setDimensionNeighbors,
    tsnePerplexity,
    setTsnePerplexity,
    sudeK1,
    setSudeK1,
    clusteringK,
    setClusteringK,
    dbscanEps,
    setDbscanEps,
    dbscanMinSamples,
    setDbscanMinSamples,
    cdcKNum,
    setCdcKNum,
    cdcRatio,
    setCdcRatio,
    similarityTopK,
    setSimilarityTopK,
    samplingThreshold,
    samplingMaxSamples,
    setSamplingThreshold,
    setSamplingMaxSamples,
  } = useAppStore();

  const [poiUploadName, setPoiUploadName] = useState<string | null>(null);
  const [trajUploadName, setTrajUploadName] = useState<string | null>(null);
  const [analysisAdvancedOpen, setAnalysisAdvancedOpen] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, kind: "poi" | "traj") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text) as FeatureCollection;
    if (kind === "poi") {
      setPoiUploadName(file.name);
      await uploadPoiGeoJSON(payload);
      return;
    }
    setTrajUploadName(file.name);
    await uploadTrajectoryGeoJSON(payload);
  };

  const loadPublicGeoJSON = async (path: string): Promise<FeatureCollection> => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`加载示例失败：${res.status}`);
    return (await res.json()) as FeatureCollection;
  };

  const canRun = Boolean(poiDatasetId && trajDatasetId) && !isLoading;

  return (
    <aside className="panel algo-panel">
      <div className="panel-header">
        <div className="brand">算法模块</div>
        <div className="subtitle">POI 半径检索 → 轨迹点表征 → 降维/聚类/相似</div>
      </div>

      <div className="panel-section">
        <div className="section-title">数据</div>
        <label className="upload">
          <input type="file" accept=".json,.geojson" onChange={(e) => void handleUpload(e, "poi")} />
          ⤴ 上传 POI GeoJSON
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            void (async () => {
              const payload = await loadPublicGeoJSON("/samples/poi_demo.geojson");
              setPoiUploadName("samples/poi_demo.geojson");
              await uploadPoiGeoJSON(payload);
            })();
          }}
          disabled={isLoading}
        >
          ⚡ 加载示例 POI
        </button>
        <div className="hint">
          POI 数据集: {poiDatasetId ?? "-"} {poiDatasetId ? `(${poiCount})` : ""} {poiUploadName ? `| ${poiUploadName}` : ""}
        </div>

        <label className="upload">
          <input type="file" accept=".json,.geojson" onChange={(e) => void handleUpload(e, "traj")} />
          ⤴ 上传 轨迹点 GeoJSON
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            void (async () => {
              const payload = await loadPublicGeoJSON("/samples/traj_demo.geojson");
              setTrajUploadName("samples/traj_demo.geojson");
              setTrajRadiusM(320);
              await uploadTrajectoryGeoJSON(payload);
            })();
          }}
          disabled={isLoading}
        >
          ⚡ 加载示例 轨迹
        </button>
        <div className="hint">
          轨迹数据集: {trajDatasetId ?? "-"} {trajDatasetId ? `(${trajPointCount})` : ""} {trajUploadName ? `| ${trajUploadName}` : ""}
        </div>
      </div>

      <div className="panel-section">
        <div className="section-title">POI 检索</div>
        <label className="control-label">
          距离半径（米）
          <input className="text-input" type="number" min={1} value={trajRadiusM} onChange={(e) => setTrajRadiusM(Number(e.target.value))} />
        </label>
        <label className="control-label">
          向量维度（hash）
          <input
            className="text-input"
            type="number"
            min={8}
            max={4096}
            step={8}
            value={trajVectorDim}
            onChange={(e) => setTrajVectorDim(Number(e.target.value))}
          />
        </label>
        <label className="control-label">
          POI 类别字段
          <input className="text-input" type="text" value={trajPoiCategoryField} onChange={(e) => setTrajPoiCategoryField(e.target.value)} placeholder="category" />
        </label>
        <label className="control-label">
          坐标系（POI 与轨迹必须一致）
          <select className="select" value={trajCoordSystem} onChange={(e) => setTrajCoordSystem(e.target.value as any)}>
            <option value="gcj02">GCJ02</option>
            <option value="wgs84">WGS84</option>
            <option value="bd09">BD09</option>
          </select>
        </label>
      </div>

      <div className="panel-section">
        <div className="section-title">分析参数</div>
        <div className="hint">修改这些参数后需要重新点击“开始轨迹分析”。</div>
        <label className="control-label">降维方法</label>
        <select className="select" value={dimensionMethod} onChange={(e) => setDimensionMethod(e.target.value as DimensionMethod)}>
          <option value="sude">SUDE</option>
          <option value="pca">PCA</option>
          <option value="umap">UMAP</option>
          <option value="lle">LLE</option>
          <option value="tsne">TSNE</option>
        </select>
        <label className="control-label">聚类方法</label>
        <select className="select" value={clusteringMethod} onChange={(e) => setClusteringMethod(e.target.value as ClusteringMethod)}>
          <option value="kmeans">KMeans</option>
          <option value="cdp">CDP</option>
          <option value="dbscan">DBSCAN</option>
          <option value="lgc">LGC</option>
          <option value="cdc">CDC</option>
        </select>
        <label className="control-label">相似度</label>
        <select className="select" value={similarityMethod} onChange={(e) => setSimilarityMethod(e.target.value as SimilarityMethod)}>
          <option value="cosine">Cosine</option>
          <option value="dot">Dot</option>
          <option value="euclidean">Euclidean</option>
        </select>

        <button type="button" className="btn ghost" onClick={() => setAnalysisAdvancedOpen((v) => !v)}>
          {analysisAdvancedOpen ? "▾ 收起高级参数" : "▸ 展开高级参数"}
        </button>

        {analysisAdvancedOpen && (
          <div className="advanced-grid">
            <div className="control-label">降维输出维度</div>
            <div className="segmented compact">
              <button type="button" className={dimensionComponents === 2 ? "active" : ""} onClick={() => setDimensionComponents(2)}>
                2D
              </button>
              <button type="button" className={dimensionComponents === 3 ? "active" : ""} onClick={() => setDimensionComponents(3)}>
                3D
              </button>
            </div>

            {(dimensionMethod === "umap" || dimensionMethod === "lle") && (
              <label className="control-label">
                {dimensionMethod.toUpperCase()} n_neighbors
                <input className="text-input" type="number" min={2} value={dimensionNeighbors} onChange={(e) => setDimensionNeighbors(Number(e.target.value))} />
              </label>
            )}

            {dimensionMethod === "tsne" && (
              <label className="control-label">
                TSNE perplexity
                <input className="text-input" type="number" min={1} value={tsnePerplexity} onChange={(e) => setTsnePerplexity(Number(e.target.value))} />
              </label>
            )}

            {dimensionMethod === "sude" && (
              <label className="control-label">
                SUDE k1
                <input className="text-input" type="number" min={2} value={sudeK1} onChange={(e) => setSudeK1(Number(e.target.value))} />
              </label>
            )}

            {(clusteringMethod === "kmeans" || clusteringMethod === "lgc") && (
              <label className="control-label">
                {clusteringMethod.toUpperCase()} n_clusters
                <input className="text-input" type="number" min={2} value={clusteringK} onChange={(e) => setClusteringK(Number(e.target.value))} />
              </label>
            )}

            {(clusteringMethod === "dbscan" || clusteringMethod === "cdp") && (
              <>
                <label className="control-label">
                  {clusteringMethod.toUpperCase()} eps
                  <input className="text-input" type="number" step={0.1} min={0.1} value={dbscanEps} onChange={(e) => setDbscanEps(Number(e.target.value))} />
                </label>
                <label className="control-label">
                  {clusteringMethod.toUpperCase()} min_samples
                  <input className="text-input" type="number" min={1} value={dbscanMinSamples} onChange={(e) => setDbscanMinSamples(Number(e.target.value))} />
                </label>
              </>
            )}

            {clusteringMethod === "cdc" && (
              <>
                <label className="control-label">
                  CDC k_num
                  <input className="text-input" type="number" min={1} value={cdcKNum} onChange={(e) => setCdcKNum(Number(e.target.value))} />
                </label>
                <label className="control-label">
                  CDC ratio
                  <input className="text-input" type="number" step={0.01} min={0.01} max={0.99} value={cdcRatio} onChange={(e) => setCdcRatio(Number(e.target.value))} />
                </label>
              </>
            )}

            <label className="control-label">
              Similarity top_k
              <input className="text-input" type="number" min={5} max={200} value={similarityTopK} onChange={(e) => setSimilarityTopK(Number(e.target.value))} />
            </label>

            <label className="control-label">
              Sampling threshold
              <input className="text-input" type="number" min={1000} value={samplingThreshold} onChange={(e) => setSamplingThreshold(Number(e.target.value))} />
            </label>
            <label className="control-label">
              Sampling max_samples
              <input className="text-input" type="number" min={500} value={samplingMaxSamples} onChange={(e) => setSamplingMaxSamples(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>

      <div className="panel-section">
        <button type="button" className="btn" onClick={() => void runTrajectoryAnalysis()} disabled={!canRun}>
          ▶ 开始轨迹分析
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="panel-section">
        <div className="section-title">任务进度</div>
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, analysisProgress))}%` }} />
          </div>
          <div className="progress-meta" title={`${analysisStatus} | ${analysisProgress}% | ${analysisStage || "-"}`}>
            <span className="progress-chip">{analysisStatus}</span>
            <span className="progress-chip">{analysisProgress}%</span>
            <span className="progress-chip progress-chip-stage" title={analysisStage}>
              {analysisStage || "-"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

