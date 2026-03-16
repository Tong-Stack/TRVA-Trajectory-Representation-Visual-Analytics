import { create } from "zustand";
import type { FeatureCollection, FeatureKind, LabelFieldMeta, NeighborItem } from "../types";
import { buildLabelColorMap, type PaletteId } from "../utils/colors";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type ViewMode = "dual" | "single";
export type BasemapStyleId = "baidu";
export type BaiduTheme = "normal" | "dark";
export type HighlightMode = "click" | "hover";
export type SelectionSource = "embedding-click" | "map-click" | "embedding-hover" | "map-hover";
export type MapColorSource = "active" | "compare-top" | "compare-bottom";
export type DimensionMethod = "sude" | "pca" | "umap" | "lle" | "tsne";
export type ClusteringMethod = "kmeans" | "cdp" | "dbscan" | "lgc" | "cdc";
export type SimilarityMethod = "cosine" | "dot" | "euclidean";
const DEFAULT_BASEMAP: BasemapStyleId = "baidu";
const DEFAULT_SEQUENCE_SPEED = 0.22;

interface StartAnalysisResponse {
  task_id: string;
}

interface PoiUploadResponse {
  poi_dataset_id: string;
  poi_count: number;
}

interface TrajUploadResponse {
  traj_dataset_id: string;
  point_count: number;
}

interface TrajProgressResponse {
  task_id: string;
  traj_dataset_id: string;
  poi_dataset_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage: string;
  message: string;
  error?: string | null;
}

interface SamplingNotice {
  truncated: boolean;
  total: number;
  shown: number;
}

interface MapViewportState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapLayerVisibility {
  basemap: boolean;
  overlay: boolean;
}

type PoiVizMode = "off" | "nearby" | "all";

interface AppState {
  viewMode: ViewMode;
  hoveredId: string | null;
  selectedId: string | null;
  similarIds: string[];
  highlightMode: HighlightMode;
  hoverPreviewId: string | null;
  hoverPreviewSimilarIds: string[];
  selectionSource: SelectionSource | null;
  selectionNonce: number;
  topK: number;
  sequenceSpeed: number;
  mapIs3d: boolean;
  basemapStyleId: BasemapStyleId;
  baiduTheme: BaiduTheme;
  mapLayerVisibility: MapLayerVisibility;
  data: FeatureCollection | null;
  labelColorMap: Record<string, string>;
  activeLabelField: string;
  labelFields: LabelFieldMeta[];
  compareMode: boolean;
  compareLabelTop: string;
  compareLabelBottom: string;
  mapColorSource: MapColorSource;
  paletteId: PaletteId;
  embeddingTrajectoryEnabled: boolean;
  samplingThreshold: number;
  samplingMaxSamples: number;
  samplingNotice: SamplingNotice | null;
  mapViewport: MapViewportState | null;
  dataNonce: number;
  isLoading: boolean;
  error: string | null;
  analysisProgress: number;
  analysisStage: string;
  analysisStatus: "idle" | "queued" | "running" | "completed" | "failed";
  dimensionMethod: DimensionMethod;
  clusteringMethod: ClusteringMethod;
  similarityMethod: SimilarityMethod;
  dimensionComponents: 2 | 3;
  dimensionNeighbors: number;
  tsnePerplexity: number;
  sudeK1: number;
  clusteringK: number;
  dbscanEps: number;
  dbscanMinSamples: number;
  cdcKNum: number;
  cdcRatio: number;
  similarityTopK: number;
  uploadPoiGeoJSON: (payload: FeatureCollection) => Promise<void>;
  uploadTrajectoryGeoJSON: (payload: FeatureCollection) => Promise<void>;
  runTrajectoryAnalysis: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setHoveredId: (id: string | null) => void;
  setSelectedId: (id: string | null, source?: SelectionSource) => Promise<void>;
  setHoverPreview: (id: string | null, source?: SelectionSource) => void;
  clearHoverPreview: () => void;
  setHighlightMode: (mode: HighlightMode) => void;
  setMapLayerVisibility: (value: Partial<MapLayerVisibility>) => void;
  setTopK: (value: number) => void;
  setSequenceSpeed: (value: number) => void;
  setMapIs3d: (value: boolean) => void;
  setBasemapStyleId: (value: BasemapStyleId) => void;
  setBaiduTheme: (value: BaiduTheme) => void;
  setDimensionMethod: (value: DimensionMethod) => void;
  setClusteringMethod: (value: ClusteringMethod) => void;
  setSimilarityMethod: (value: SimilarityMethod) => void;
  setDimensionComponents: (value: 2 | 3) => void;
  setDimensionNeighbors: (value: number) => void;
  setTsnePerplexity: (value: number) => void;
  setSudeK1: (value: number) => void;
  setClusteringK: (value: number) => void;
  setDbscanEps: (value: number) => void;
  setDbscanMinSamples: (value: number) => void;
  setCdcKNum: (value: number) => void;
  setCdcRatio: (value: number) => void;
  setSimilarityTopK: (value: number) => void;
  setSamplingThreshold: (value: number) => void;
  setSamplingMaxSamples: (value: number) => void;
  setActiveLabelField: (field: string) => void;
  setCompareMode: (value: boolean) => void;
  setCompareLabelTop: (field: string) => void;
  setCompareLabelBottom: (field: string) => void;
  setMapColorSource: (value: MapColorSource) => void;
  setPaletteId: (value: PaletteId) => void;
  setEmbeddingTrajectoryEnabled: (value: boolean) => void;
  setMapViewport: (value: MapViewportState | null) => void;
  clearSimilar: () => void;
  clearSelection: () => void;

  poiData: FeatureCollection | null;
  poiVizMode: PoiVizMode;
  poiShowLabels: boolean;
  setPoiVizMode: (value: PoiVizMode) => void;
  setPoiShowLabels: (value: boolean) => void;

  poiDatasetId: string | null;
  poiCount: number;
  trajDatasetId: string | null;
  trajPointCount: number;
  trajRadiusM: number;
  trajVectorDim: number;
  trajPoiCategoryField: string;
  trajCoordSystem: "gcj02" | "wgs84" | "bd09";

  trajTimeline: string[];
  trajPlayhead: number;
  trajIsPlaying: boolean;
  trajPlaybackSpeed: number;
  trajActiveId: string | null;
  setTrajRadiusM: (value: number) => void;
  setTrajVectorDim: (value: number) => void;
  setTrajPoiCategoryField: (value: string) => void;
  setTrajCoordSystem: (value: "gcj02" | "wgs84" | "bd09") => void;
  setTrajPlayhead: (value: number) => void;
  setTrajIsPlaying: (value: boolean) => void;
  setTrajPlaybackSpeed: (value: number) => void;
}

const parseNeighborIds = (
  neighbors: NeighborItem[] | string[] | undefined,
  topK: number,
  selectedId: string
): string[] => {
  if (!Array.isArray(neighbors) || neighbors.length === 0) return [];
  const result: string[] = [];
  for (const item of neighbors) {
    const neighborId = typeof item === "string" ? item : item.id;
    if (!neighborId || neighborId === selectedId) continue;
    result.push(neighborId);
    if (result.length >= topK) break;
  }
  return result;
};

const getSimilarFromData = (data: FeatureCollection | null, selectedId: string, topK: number): string[] => {
  if (!data) return [];
  const feature = data.features.find((f) => f.properties.id === selectedId);
  if (!feature) return [];
  return parseNeighborIds(feature.properties.neighbors, topK, selectedId);
};

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }
  return res.json() as Promise<T>;
};

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Request failed");
  }
  return res.json() as Promise<T>;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePointFeatureCollection = (
  payload: FeatureCollection,
  opts: { role: "poi" | "traj_point"; idPrefix: string }
): FeatureCollection => {
  if (!payload || payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("Only FeatureCollection is supported");
  }
  const features = payload.features.map((feature: any, idx: number) => {
    const geometry = feature?.geometry ?? {};
    if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      throw new Error(`feature[${idx}] must be a Point`);
    }
    const lng = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error(`feature[${idx}] invalid lng/lat`);
    }
    const props = (feature?.properties ?? {}) as any;
    const idRaw = typeof props.id === "string" ? props.id.trim() : "";
    const id = idRaw ? idRaw : `${opts.idPrefix}_${idx}`;
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lng, lat] },
      properties: {
        ...props,
        id,
        kind: "poi",
        feature_role: opts.role,
      },
    };
  });
  return { type: "FeatureCollection" as const, features };
};

const buildTrajectoryTimeline = (data: FeatureCollection | null): string[] => {
  if (!data || !Array.isArray(data.features) || data.features.length === 0) return [];
  const rows = data.features
    .filter((f) => (f.properties as any)?.feature_role === "traj_point")
    .map((f, index) => {
      const props: any = f.properties ?? {};
      const id = String(props.id ?? "");
      const tsRaw = props.ts;
      const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
      const ts = Number.isFinite(tsNum) ? tsNum : null;
      const seqNum = Number(props.seq);
      const seq = Number.isFinite(seqNum) ? seqNum : null;
      return { id, ts, seq, index };
    })
    .filter((r) => r.id);
  const hasTs = rows.some((r) => r.ts !== null);
  const hasSeq = rows.some((r) => r.seq !== null);
  rows.sort((a, b) => {
    if (hasTs) return (a.ts ?? a.index) - (b.ts ?? b.index);
    if (hasSeq) return (a.seq ?? a.index) - (b.seq ?? b.index);
    return a.index - b.index;
  });
  return rows.map((r) => r.id);
};

const discoverLabelFieldsClient = (data: FeatureCollection | null): LabelFieldMeta[] => {
  if (!data || !Array.isArray(data.features) || data.features.length === 0) return [];
  const skip = new Set(["embedding", "vec", "vec_3d", "reduction_embedding", "neighbors", "geometry"]);
  const prioritized = new Set(["cluster_id", "cluster_label"]);
  const values: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};
  for (const feature of data.features) {
    const props = feature.properties ?? {};
    Object.entries(props).forEach(([k, v]) => {
      if (skip.has(k)) return;
      if (Array.isArray(v) || (typeof v === "object" && v !== null)) return;
      if (v === undefined || v === null) return;
      const text = String(v).trim();
      if (!text) return;
      if (!values[k]) values[k] = new Set();
      values[k].add(text);
      counts[k] = (counts[k] ?? 0) + 1;
    });
  }
  const total = data.features.length;
  const fields = Object.entries(values)
    .filter(([field, set]) => (prioritized.has(field) ? true : set.size > 1 && set.size <= 80))
    .map(([field, set]) => ({
      field,
      label: field,
      unique_count: set.size,
      coverage: Number(((counts[field] ?? 0) / Math.max(1, total)).toFixed(4)),
    }))
    .filter((item) => (prioritized.has(item.field) ? true : (item.coverage ?? 0) >= 0.15))
    .sort((a, b) => {
      const rank = (name: string) => (["info", "cluster_label", "cluster_id"].includes(name) ? 0 : 1);
      return rank(a.field) - rank(b.field) || a.field.localeCompare(b.field, "zh-CN");
    });
  return fields;
};

const chooseLabelDefault = (fields: LabelFieldMeta[], preferred?: string | null): string => {
  if (preferred && fields.some((item) => item.field === preferred)) return preferred;
  const fallback = ["info", "cluster_label", "cluster_id", "class", "name"];
  for (const item of fallback) {
    if (fields.some((field) => field.field === item)) return item;
  }
  return fields[0]?.field ?? "info";
};

const chooseCompareBottomField = (fields: LabelFieldMeta[], topField: string): string => {
  const hasClusterLabel = fields.some((item) => item.field === "cluster_label");
  if (hasClusterLabel && topField !== "cluster_label") return "cluster_label";
  const hasClusterId = fields.some((item) => item.field === "cluster_id");
  if (hasClusterId && topField !== "cluster_id") return "cluster_id";
  return fields.find((item) => item.field !== topField)?.field ?? topField;
};

const chooseCompareTopField = (fields: LabelFieldMeta[], fallback: string): string => {
  return fields.some((item) => item.field === "info") ? "info" : fallback;
};

const buildColorMapWithState = (
  data: FeatureCollection | null,
  activeLabelField: string,
  paletteId: PaletteId,
  existing: Record<string, string>
) => buildLabelColorMap(data, activeLabelField, paletteId, existing);

export const useAppStore = create<AppState>((set, get) => ({
  viewMode: "dual",
  hoveredId: null,
  selectedId: null,
  similarIds: [],
  highlightMode: "click",
  hoverPreviewId: null,
  hoverPreviewSimilarIds: [],
  selectionSource: null,
  selectionNonce: 0,
  topK: 20,
  sequenceSpeed: DEFAULT_SEQUENCE_SPEED,
  mapIs3d: false,
  basemapStyleId: DEFAULT_BASEMAP,
  baiduTheme: "dark",
  mapLayerVisibility: { basemap: true, overlay: true },
  data: null,
  labelColorMap: {},
  activeLabelField: "info",
  labelFields: [],
  compareMode: false,
  compareLabelTop: "info",
  compareLabelBottom: "cluster_label",
  mapColorSource: "active",
  paletteId: "givaClassic",
  embeddingTrajectoryEnabled: true,
  samplingThreshold: 20000,
  samplingMaxSamples: 5000,
  samplingNotice: null,
  mapViewport: null,
  dataNonce: 0,
  isLoading: false,
  error: null,
  analysisProgress: 0,
  analysisStage: "",
  analysisStatus: "idle",
  dimensionMethod: "sude",
  clusteringMethod: "cdc",
  similarityMethod: "cosine",
  dimensionComponents: 3,
  dimensionNeighbors: 30,
  tsnePerplexity: 30,
  sudeK1: 10,
  clusteringK: 6,
  dbscanEps: 0.5,
  dbscanMinSamples: 5,
  cdcKNum: 20,
  cdcRatio: 0.9,
  similarityTopK: 50,
  poiData: null,
  poiVizMode: "nearby",
  poiShowLabels: false,
  poiDatasetId: null,
  poiCount: 0,
  trajDatasetId: null,
  trajPointCount: 0,
  trajRadiusM: 200,
  trajVectorDim: 256,
  trajPoiCategoryField: "category",
  trajCoordSystem: "gcj02",
  trajTimeline: [],
  trajPlayhead: 0,
  trajIsPlaying: false,
  trajPlaybackSpeed: 1,
  trajActiveId: null,

  setPoiVizMode: (value) => set({ poiVizMode: value }),
  setPoiShowLabels: (value) => set({ poiShowLabels: Boolean(value) }),

  uploadPoiGeoJSON: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const normalized = normalizePointFeatureCollection(payload, { role: "poi", idPrefix: "poi" });
      const res = await postJson<PoiUploadResponse>(`${API_BASE}/traj/poi/upload`, normalized);
      set({ poiDatasetId: res.poi_dataset_id, poiCount: res.poi_count, poiData: normalized, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  uploadTrajectoryGeoJSON: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const normalized = normalizePointFeatureCollection(payload, { role: "traj_point", idPrefix: "tp" });
      const res = await postJson<TrajUploadResponse>(`${API_BASE}/traj/track/upload`, normalized);
      set({ trajDatasetId: res.traj_dataset_id, trajPointCount: res.point_count, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },

  runTrajectoryAnalysis: async () => {
    const {
      poiDatasetId,
      trajDatasetId,
      trajRadiusM,
      trajVectorDim,
      trajPoiCategoryField,
      trajCoordSystem,
      dimensionMethod,
      clusteringMethod,
      similarityMethod,
      dimensionComponents,
      dimensionNeighbors,
      tsnePerplexity,
      sudeK1,
      clusteringK,
      dbscanEps,
      dbscanMinSamples,
      cdcKNum,
      cdcRatio,
      similarityTopK,
      samplingThreshold,
      samplingMaxSamples,
      activeLabelField,
      paletteId,
    } = get();
    if (!poiDatasetId || !trajDatasetId) {
      set({ error: "请先上传 POI 和轨迹数据" });
      return;
    }

    set({
      isLoading: true,
      error: null,
      analysisProgress: 0,
      analysisStage: "queued",
      analysisStatus: "queued",
    });

    try {
      const startRes = await postJson<StartAnalysisResponse>(`${API_BASE}/api/traj-analysis/start`, {
        traj_dataset_id: trajDatasetId,
        poi_dataset_id: poiDatasetId,
        radius_m: trajRadiusM,
        vector_dim: Math.max(8, Math.floor(trajVectorDim)),
        poi_category_field: trajPoiCategoryField,
        coord_system: trajCoordSystem,
        dimension: {
          enabled: true,
          method: dimensionMethod,
          params: {
            n_components: dimensionComponents,
            n_neighbors: Math.max(2, Math.floor(dimensionNeighbors)),
            perplexity: Math.max(1, Number.isFinite(tsnePerplexity) ? tsnePerplexity : 30),
            sude_k1: Math.max(2, Math.floor(sudeK1)),
          },
        },
        clustering: {
          enabled: true,
          method: clusteringMethod,
          params: {
            n_clusters: Math.max(2, Math.floor(clusteringK)),
            eps: Number.isFinite(dbscanEps) ? dbscanEps : 0.5,
            min_samples: Math.max(1, Math.floor(dbscanMinSamples)),
            k_num: Math.max(1, Math.floor(cdcKNum)),
            ratio: Math.min(0.999, Math.max(0.001, Number.isFinite(cdcRatio) ? cdcRatio : 0.9)),
          },
        },
        similarity: {
          enabled: true,
          method: similarityMethod,
          top_k: Math.max(5, Math.floor(similarityTopK)),
        },
        sampling: {
          enabled: true,
          threshold: Math.max(1000, Math.floor(samplingThreshold)),
          max_samples: Math.min(
            Math.max(500, Math.floor(samplingMaxSamples)),
            Math.max(1000, Math.floor(samplingThreshold))
          ),
          strategy: "metric_top",
        },
      });

      const taskId = startRes.task_id;
      let done = false;
      while (!done) {
        const progress = await getJson<TrajProgressResponse>(
          `${API_BASE}/api/traj-analysis/progress?task_id=${encodeURIComponent(taskId)}`
        );
        set({
          analysisProgress: progress.progress,
          analysisStage: progress.message || progress.stage,
          analysisStatus: progress.status,
        });
        if (progress.status === "failed") {
          throw new Error(progress.error || progress.message || "Analysis failed");
        }
        if (progress.status === "completed") {
          done = true;
          break;
        }
        await sleep(500);
      }

      const data = await getJson<FeatureCollection>(`${API_BASE}/api/traj-analysis/result?task_id=${encodeURIComponent(taskId)}`);
      const fromMeta = data.meta?.label_fields ?? [];
      const mergedFields = fromMeta.length > 0 ? fromMeta : discoverLabelFieldsClient(data);
      const labelDefault = chooseLabelDefault(mergedFields, data.meta?.active_label_default ?? activeLabelField);
      const selectedId = get().selectedId;
      const similarIds = selectedId ? getSimilarFromData(data, selectedId, get().topK) : [];
      const hoverPreviewId = get().hoverPreviewId;
      const hoverPreviewSimilarIds = hoverPreviewId ? getSimilarFromData(data, hoverPreviewId, get().topK) : [];
      const samplingMeta = data.meta?.sampling;
      const nextMap = buildColorMapWithState(data, labelDefault, paletteId, {});
      const trajTimeline = buildTrajectoryTimeline(data);
      const trajPlayhead = Math.min(get().trajPlayhead, Math.max(0, trajTimeline.length - 1));
      const trajActiveId = trajTimeline.length > 0 ? trajTimeline[trajPlayhead] : null;

      set((state) => {
        const nextCompareTop = chooseCompareTopField(mergedFields, labelDefault);
        const nextCompareBottom = chooseCompareBottomField(mergedFields, nextCompareTop);
        return {
          data,
          similarIds,
          hoverPreviewSimilarIds,
          labelColorMap: nextMap,
          labelFields: mergedFields,
          activeLabelField: labelDefault,
          compareLabelTop: nextCompareTop,
          compareLabelBottom: nextCompareBottom,
          samplingNotice: samplingMeta
            ? {
                truncated: Boolean(samplingMeta.truncated),
                total: Number(samplingMeta.total ?? data.features.length),
                shown: Number(samplingMeta.shown ?? data.features.length),
              }
            : null,
          trajTimeline,
          trajPlayhead,
          trajActiveId,
          dataNonce: state.dataNonce + 1,
          isLoading: false,
          analysisStatus: "completed",
        };
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message, analysisStatus: "failed" });
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setSelectedId: async (id, source = "embedding-click") => {
    if (!id) {
      set((state) => ({
        selectedId: null,
        similarIds: [],
        hoverPreviewId: null,
        hoverPreviewSimilarIds: [],
        selectionSource: null,
        selectionNonce: state.selectionNonce + 1,
      }));
      return;
    }
    const { data, topK } = get();
    const similarIds = getSimilarFromData(data, id, topK);
    set((state) => ({
      selectedId: id,
      similarIds,
      hoverPreviewId: null,
      hoverPreviewSimilarIds: [],
      selectionSource: source,
      selectionNonce: state.selectionNonce + 1,
    }));
  },
  setHoverPreview: (id, source = "embedding-hover") => {
    const { data, topK } = get();
    if (!id) {
      const current = get();
      if (!current.hoverPreviewId && current.hoverPreviewSimilarIds.length === 0) return;
      set((state) => ({
        hoverPreviewId: null,
        hoverPreviewSimilarIds: [],
        selectionSource: source,
        selectionNonce: state.selectionNonce + 1,
      }));
      return;
    }
    const current = get();
    if (current.hoverPreviewId === id && current.selectionSource === source) return;
    set((state) => ({
      hoverPreviewId: id,
      hoverPreviewSimilarIds: getSimilarFromData(data, id, topK),
      selectionSource: source,
      selectionNonce: state.selectionNonce + 1,
    }));
  },
  clearHoverPreview: () => {
    set({
      hoverPreviewId: null,
      hoverPreviewSimilarIds: [],
    });
  },
  setHighlightMode: (mode) =>
    set((state) => {
      if (mode === "hover") return { highlightMode: mode };
      return {
        highlightMode: mode,
        hoverPreviewId: null,
        hoverPreviewSimilarIds: [],
      };
    }),
  setMapLayerVisibility: (value) =>
    set((state) => ({
      mapLayerVisibility: {
        ...state.mapLayerVisibility,
        ...value,
      },
    })),
  setTopK: (value) => {
    const nextTopK = Number.isFinite(value) ? value : 20;
    const { selectedId, hoverPreviewId, data } = get();
    const similarIds = selectedId ? getSimilarFromData(data, selectedId, nextTopK) : [];
    const hoverPreviewSimilarIds = hoverPreviewId ? getSimilarFromData(data, hoverPreviewId, nextTopK) : [];
    set({ topK: nextTopK, similarIds, hoverPreviewSimilarIds });
  },
  setSequenceSpeed: (value) => {
    const candidate = Number.isFinite(value) ? value : DEFAULT_SEQUENCE_SPEED;
    set({ sequenceSpeed: Math.max(0.02, Math.min(1, candidate)) });
  },
  setMapIs3d: (value) => set({ mapIs3d: value }),
  setBasemapStyleId: (value) => set({ basemapStyleId: value }),
  setBaiduTheme: (value) => set({ baiduTheme: value }),
  setDimensionMethod: (value) => set({ dimensionMethod: value }),
  setClusteringMethod: (value) => set({ clusteringMethod: value }),
  setSimilarityMethod: (value) => set({ similarityMethod: value }),
  setDimensionComponents: (value) => set({ dimensionComponents: value }),
  setDimensionNeighbors: (value) => set({ dimensionNeighbors: Number.isFinite(value) ? value : 30 }),
  setTsnePerplexity: (value) => set({ tsnePerplexity: Number.isFinite(value) ? value : 30 }),
  setSudeK1: (value) => set({ sudeK1: Number.isFinite(value) ? value : 10 }),
  setClusteringK: (value) => set({ clusteringK: Number.isFinite(value) ? value : 6 }),
  setDbscanEps: (value) => set({ dbscanEps: Number.isFinite(value) ? value : 0.5 }),
  setDbscanMinSamples: (value) => set({ dbscanMinSamples: Number.isFinite(value) ? value : 5 }),
  setCdcKNum: (value) => set({ cdcKNum: Number.isFinite(value) ? value : 20 }),
  setCdcRatio: (value) => set({ cdcRatio: Number.isFinite(value) ? value : 0.9 }),
  setSimilarityTopK: (value) => set({ similarityTopK: Number.isFinite(value) ? value : 50 }),
  setSamplingThreshold: (value) =>
    set((state) => {
      const threshold = Math.max(1000, Number.isFinite(value) ? Math.floor(value) : 20000);
      return {
        samplingThreshold: threshold,
        samplingMaxSamples: Math.min(state.samplingMaxSamples, threshold),
      };
    }),
  setSamplingMaxSamples: (value) =>
    set((state) => {
      const candidate = Math.max(500, Number.isFinite(value) ? Math.floor(value) : 5000);
      return { samplingMaxSamples: Math.min(candidate, state.samplingThreshold) };
    }),
  setActiveLabelField: (field) =>
    set((state) => ({
      activeLabelField: field,
      labelColorMap: buildColorMapWithState(state.data, field, state.paletteId, {}),
    })),
  setCompareMode: (value) =>
    set((state) => {
      if (!value) return { compareMode: false, mapColorSource: "active" };
      const fallbackTop = chooseLabelDefault(state.labelFields, state.activeLabelField);
      const compareTop = chooseCompareTopField(state.labelFields, fallbackTop);
      const compareBottom = chooseCompareBottomField(state.labelFields, compareTop);
      return {
        compareMode: true,
        compareLabelTop: compareTop,
        compareLabelBottom: compareBottom,
        mapColorSource: "compare-top",
      };
    }),
  setCompareLabelTop: (field) => set({ compareLabelTop: field }),
  setCompareLabelBottom: (field) => set({ compareLabelBottom: field }),
  setMapColorSource: (value) => set({ mapColorSource: value }),
  setPaletteId: (value) =>
    set((state) => ({
      paletteId: value,
      labelColorMap: buildColorMapWithState(state.data, state.activeLabelField, value, {}),
    })),
  setEmbeddingTrajectoryEnabled: (value) => set({ embeddingTrajectoryEnabled: value }),
  setMapViewport: (value) => set({ mapViewport: value }),
  clearSimilar: () => set({ similarIds: [] }),
  clearSelection: () =>
    set((state) => ({
      selectedId: null,
      similarIds: [],
      hoveredId: null,
      hoverPreviewId: null,
      hoverPreviewSimilarIds: [],
      selectionSource: null,
      selectionNonce: state.selectionNonce + 1,
    })),

  setTrajRadiusM: (value) => set({ trajRadiusM: Math.max(1, Number.isFinite(value) ? value : 200) }),
  setTrajVectorDim: (value) => set({ trajVectorDim: Math.max(8, Math.min(4096, Math.floor(Number(value) || 256))) }),
  setTrajPoiCategoryField: (value) => set({ trajPoiCategoryField: (value || "category").trim() || "category" }),
  setTrajCoordSystem: (value) => set({ trajCoordSystem: value }),
  setTrajPlayhead: (value) =>
    set((state) => {
      const maxIndex = Math.max(0, state.trajTimeline.length - 1);
      const clamped = Math.max(0, Math.min(maxIndex, Math.floor(value)));
      const activeId = state.trajTimeline.length > 0 ? state.trajTimeline[clamped] : null;
      return { trajPlayhead: clamped, trajActiveId: activeId };
    }),
  setTrajIsPlaying: (value) => set({ trajIsPlaying: value }),
  setTrajPlaybackSpeed: (value) =>
    set({ trajPlaybackSpeed: Math.max(0.2, Math.min(8, Number.isFinite(value) ? value : 1)) }),
}));

export const getVisibleKinds = (): FeatureKind[] => ["cell", "poi"];
