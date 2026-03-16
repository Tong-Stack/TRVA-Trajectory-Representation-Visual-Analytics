export type FeatureKind = "cell" | "poi";

export interface NeighborItem {
  id: string;
  score: number;
}

export interface LabelFieldMeta {
  field: string;
  label: string;
  unique_count?: number;
  coverage?: number;
}

export interface SamplingMeta {
  enabled: boolean;
  truncated: boolean;
  strategy: "metric_top";
  threshold: number;
  max_samples: number;
  total: number;
  shown: number;
}

export interface AnalysisMeta {
  sampling?: SamplingMeta;
  label_fields?: LabelFieldMeta[];
  active_label_default?: string;
}

export interface FeatureProperties {
  id: string;
  kind?: FeatureKind;
  feature_role?: "poi" | "traj_point" | string;
  traj_id?: string;
  ts?: number | string;
  seq?: number;
  coord_system?: string;
  radius_m?: number;
  poi_in_radius?: number;
  name?: string;
  class?: string;
  h3?: string;
  embedding?: number[];
  emb3?: [number, number, number];
  vec_3d?: [number, number, number];
  reduction_embedding?: number[];
  cluster_id?: number;
  metric?: number;
  vec?: number[];
  info?: string;
  cluster_label?: string;
  neighbors?: NeighborItem[] | string[];
  [key: string]: unknown;
}

export interface GeoFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: FeatureProperties;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
  meta?: AnalysisMeta;
}
