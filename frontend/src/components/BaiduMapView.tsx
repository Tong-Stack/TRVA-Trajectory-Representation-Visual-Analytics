import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAP_VISUAL_TOPK } from "../constants/trajectory";
import { useAppStore, type BaiduTheme, type MapColorSource } from "../store/useAppStore";
import type { GeoFeature } from "../types";
import { buildLabelColorMap, getFeatureLabelValue } from "../utils/colors";

const BAIDU_AK = import.meta.env.VITE_BAIDU_AK ?? "";

type BMapAny = any;

interface HoverState {
  x: number;
  y: number;
  id: string;
  label: string;
  cluster: string;
  metric: string;
}

interface HoverMeta {
  label: string;
  cluster: string;
  metric: string;
}

interface PolygonStyleConfig {
  strokeColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
}

const BAIDU_DEFAULT_STYLE_ID = import.meta.env.VITE_BAIDU_STYLE_ID ?? "";
const BAIDU_STYLE_ID_BY_THEME: Partial<Record<BaiduTheme, string>> = {
  normal: import.meta.env.VITE_BAIDU_STYLE_ID_NORMAL ?? "",
  dark: import.meta.env.VITE_BAIDU_STYLE_ID_DARK ?? BAIDU_DEFAULT_STYLE_ID,
};

const BAIDU_DARK_STYLE_JSON = [
  { featureType: "land", elementType: "geometry", stylers: { visibility: "on", color: "#091220ff" } },
  { featureType: "water", elementType: "geometry", stylers: { visibility: "on", color: "#113549ff" } },
  { featureType: "green", elementType: "geometry", stylers: { visibility: "on", color: "#0e1b30ff" } },
  { featureType: "building", elementType: "geometry", stylers: { visibility: "on" } },
  { featureType: "building", elementType: "geometry.topfill", stylers: { color: "#113549ff" } },
  { featureType: "building", elementType: "geometry.sidefill", stylers: { color: "#143e56ff" } },
  { featureType: "building", elementType: "geometry.stroke", stylers: { color: "#dadada00" } },
  { featureType: "subwaystation", elementType: "geometry", stylers: { visibility: "on", color: "#113549B2" } },
  { featureType: "education", elementType: "geometry", stylers: { visibility: "on", color: "#12223dff" } },
  { featureType: "medical", elementType: "geometry", stylers: { visibility: "on", color: "#12223dff" } },
  { featureType: "scenicspots", elementType: "geometry", stylers: { visibility: "on", color: "#12223dff" } },
  { featureType: "highway", elementType: "geometry", stylers: { visibility: "on", weight: "4" } },
  { featureType: "highway", elementType: "geometry.fill", stylers: { color: "#12223dff" } },
  { featureType: "highway", elementType: "geometry.stroke", stylers: { color: "#fed66900" } },
  { featureType: "highway", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "highway", elementType: "labels.text.fill", stylers: { color: "#12223dff" } },
  { featureType: "highway", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "highway", elementType: "labels.icon", stylers: { visibility: "on" } },
  { featureType: "arterial", elementType: "geometry", stylers: { visibility: "on", weight: "2" } },
  { featureType: "arterial", elementType: "geometry.fill", stylers: { color: "#12223dff" } },
  { featureType: "arterial", elementType: "geometry.stroke", stylers: { color: "#ffeebb00" } },
  { featureType: "arterial", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "arterial", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "arterial", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "local", elementType: "geometry", stylers: { visibility: "on", weight: "1" } },
  { featureType: "local", elementType: "geometry.fill", stylers: { color: "#12223dff" } },
  { featureType: "local", elementType: "geometry.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "local", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "local", elementType: "labels.text.fill", stylers: { color: "#979c9aff" } },
  { featureType: "local", elementType: "labels.text.stroke", stylers: { color: "#ffffffff" } },
  { featureType: "railway", elementType: "geometry", stylers: { visibility: "off" } },
  { featureType: "subway", elementType: "geometry", stylers: { visibility: "off", weight: "1" } },
  { featureType: "subway", elementType: "geometry.fill", stylers: { color: "#d8d8d8ff" } },
  { featureType: "subway", elementType: "geometry.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "subway", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "subway", elementType: "labels.text.fill", stylers: { color: "#979c9aff" } },
  { featureType: "subway", elementType: "labels.text.stroke", stylers: { color: "#ffffffff" } },
  { featureType: "continent", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "continent", elementType: "labels.icon", stylers: { visibility: "on" } },
  { featureType: "continent", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "continent", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "country", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "country", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "city", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "city", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "city", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "city", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "town", elementType: "labels.icon", stylers: { visibility: "on" } },
  { featureType: "town", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "town", elementType: "labels.text.fill", stylers: { color: "#454d50ff" } },
  { featureType: "town", elementType: "labels.text.stroke", stylers: { color: "#ffffffff" } },
  { featureType: "road", elementType: "geometry.fill", stylers: { color: "#12223dff" } },
  { featureType: "road", elementType: "geometry", stylers: { visibility: "on" } },
  { featureType: "road", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "road", elementType: "geometry.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "poilabel", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "poilabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "poilabel", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "poilabel", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "districtlabel", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "district", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "district", elementType: "labels.text", stylers: { fontsize: "20" } },
  { featureType: "district", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "district", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "water", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "water", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "manmade", elementType: "geometry", stylers: { color: "#12223dff" } },
  { featureType: "entertainment", elementType: "geometry", stylers: { color: "#12223dff" } },
  { featureType: "shopping", elementType: "geometry", stylers: { color: "#12223dff" } },
  { featureType: "estate", elementType: "geometry", stylers: { color: "#12223dff" } },
  { featureType: "transportation", elementType: "geometry", stylers: { color: "#113549ff" } },
  { featureType: "transportationlabel", elementType: "labels", stylers: { visibility: "on" } },
  { featureType: "transportationlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "transportationlabel", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "transportationlabel", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "subwaylabel", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "subwaylabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "tertiarywaysign", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "tertiarywaysign", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "provincialwaysign", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "provincialwaysign", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "nationalwaysign", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "nationalwaysign", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "highwaysign", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "highwaysign", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "village", elementType: "labels", stylers: { visibility: "off" } },
  { featureType: "airportlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "scenicspotslabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "medicallabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "entertainmentlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "estatelabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "businesstowerlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "companylabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "governmentlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "restaurantlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "hotellabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "shoppinglabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "lifeservicelabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "carservicelabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "financelabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "otherlabel", elementType: "labels.icon", stylers: { visibility: "off" } },
  { featureType: "manmade", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "manmade", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "transportation", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "transportation", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "education", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "education", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "medical", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "medical", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
  { featureType: "scenicspots", elementType: "labels.text.fill", stylers: { color: "#2dc4bbff" } },
  { featureType: "scenicspots", elementType: "labels.text.stroke", stylers: { color: "#ffffff00" } },
] as const;

const BAIDU_BLANK_STYLE_JSON = [
  { featureType: "all", elementType: "all", stylers: { visibility: "off" } },
  { featureType: "land", elementType: "geometry", stylers: { visibility: "on", color: "#050b15ff" } },
  { featureType: "water", elementType: "geometry", stylers: { visibility: "on", color: "#091727ff" } },
] as const;

let baiduScriptPromise: Promise<void> | null = null;

const waitForBaiduSdk = (timeoutMs = 12000): Promise<void> => {
  const win = window as any;
  if (win.BMapGL) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (win.BMapGL) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Baidu Map SDK timed out"));
      }
    }, 80);
  });
};

const loadBaiduScript = (ak: string): Promise<void> => {
  if (!ak) return Promise.reject(new Error("VITE_BAIDU_AK is missing"));
  if ((window as any).BMapGL) return Promise.resolve();
  if (baiduScriptPromise) return baiduScriptPromise;
  baiduScriptPromise = waitForBaiduSdk();
  return baiduScriptPromise;
};

const applyBaiduTheme = (map: BMapAny, theme: BaiduTheme, showBasemap: boolean): void => {
  if (!map) return;
  if (!showBasemap && typeof map.setMapStyleV2 === "function") {
    try {
      map.setMapStyleV2({ styleJson: BAIDU_BLANK_STYLE_JSON as unknown as any[] });
      return;
    } catch {
      // fall through
    }
  }

  const styleId = BAIDU_STYLE_ID_BY_THEME[theme];
  if (styleId && typeof map.setMapStyleV2 === "function") {
    try {
      map.setMapStyleV2({ styleId });
      return;
    } catch {
      // fall through to styleJson/legacy style
    }
  }

  if (theme === "dark" && typeof map.setMapStyleV2 === "function") {
    try {
      map.setMapStyleV2({ styleJson: BAIDU_DARK_STYLE_JSON as unknown as any[] });
      return;
    } catch {
      // fall through
    }
  }

  if (theme === "normal" && typeof map.setMapStyleV2 === "function") {
    try {
      map.setMapStyleV2({ styleJson: [] });
      return;
    } catch {
      // fall through
    }
  }

  if (typeof map.setMapStyle === "function") {
    try {
      map.setMapStyle({ style: theme });
    } catch {
      // ignore invalid style names for compatibility across SDK versions
    }
  }
};

const collectLngLat = (coords: any, out: [number, number][]) => {
  if (!coords) return;
  if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    out.push([coords[0], coords[1]]);
    return;
  }
  if (Array.isArray(coords)) coords.forEach((item) => collectLngLat(item, out));
};

const getFeatureCenter = (feature: GeoFeature | undefined): [number, number] | null => {
  if (!feature?.geometry) return null;
  const coords: [number, number][] = [];
  collectLngLat(feature.geometry.coordinates, coords);
  if (coords.length === 0) return null;
  const sx = coords.reduce((acc, p) => acc + p[0], 0);
  const sy = coords.reduce((acc, p) => acc + p[1], 0);
  return [sx / coords.length, sy / coords.length];
};

const applyPolygonStyle = (polygon: any, style: PolygonStyleConfig): void => {
  if (!polygon) return;
  try {
    if (typeof polygon.setStrokeColor === "function") polygon.setStrokeColor(style.strokeColor);
    if (typeof polygon.setStrokeWeight === "function") polygon.setStrokeWeight(style.strokeWeight);
    if (typeof polygon.setStrokeOpacity === "function") polygon.setStrokeOpacity(style.strokeOpacity);
    if (typeof polygon.setFillColor === "function") polygon.setFillColor(style.fillColor);
    if (typeof polygon.setFillOpacity === "function") polygon.setFillOpacity(style.fillOpacity);
    if (typeof polygon.setOptions === "function") polygon.setOptions(style);
  } catch {
    // ignore
  }
};

const clearOverlays = (map: BMapAny | null, overlays: any[]) => {
  if (!map || overlays.length === 0) {
    overlays.length = 0;
    return;
  }
  overlays.forEach((overlay) => {
    try {
      map.removeOverlay(overlay);
    } catch {
      // ignore
    }
  });
  overlays.length = 0;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const setMapViewImmediate = (map: BMapAny, center: any, zoom: number) => {
  const safeZoom = Number.isFinite(zoom) ? zoom : Number(map.getZoom?.() ?? 12);
  try {
    map.centerAndZoom?.(center, safeZoom, { noAnimation: true });
    return;
  } catch {
    // ignore and fallback
  }
  try {
    map.setZoom?.(safeZoom, { noAnimation: true });
  } catch {
    map.setZoom?.(safeZoom);
  }
  try {
    map.setCenter?.(center, { noAnimation: true });
  } catch {
    map.setCenter?.(center);
  }
};

const BASE_STROKE_LIGHTEN = 0;
const BASE_FILL_LIGHTEN = 0;
const BASE_STROKE_WEIGHT = 1.2;
const BASE_STROKE_OPACITY = 0.88;
const BASE_FILL_OPACITY = 0.3;

const SIMILAR_STROKE_DARKEN = 0.16;
const SIMILAR_FILL_DARKEN = 0.28;
const SIMILAR_STROKE_WEIGHT = 2.9;
const SIMILAR_STROKE_OPACITY = 0.96;
const SIMILAR_FILL_OPACITY = 0.3;

const SIMILAR_RING_STROKE_LIGHTEN = 0.42;
const SIMILAR_RING_STROKE_PULSE_LIGHTEN_BOOST = 0.04;
const SIMILAR_RING_FILL_LIGHTEN = 0.16;
const SIMILAR_RING_FILL_PULSE_LIGHTEN_BOOST = 0.26;
const SIMILAR_RING_STROKE_WEIGHT = 2.1;
const SIMILAR_RING_STROKE_OPACITY = 0.88;
const SIMILAR_RING_PULSE_STROKE_BOOST = 0.45;
const SIMILAR_RING_PULSE_OPACITY_BOOST = 0.08;
const SIMILAR_RING_FILL_OPACITY = 0;
const SIMILAR_RING_PULSE_FILL_BOOST = 0.34;

const PULSE_INTERVAL_MS = 115;
const PULSE_BASE_INTENSITY = 0.45;
const PULSE_DYNAMIC_INTENSITY = 0.75;

const brightenColor = (hex: string, mix = 0.28): string => {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#dff6ff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * mix)
    .toString(16)
    .padStart(2, "0");
  const ng = Math.round(g + (255 - g) * mix)
    .toString(16)
    .padStart(2, "0");
  const nb = Math.round(b + (255 - b) * mix)
    .toString(16)
    .padStart(2, "0");
  return `#${nr}${ng}${nb}`;
};

const darkenColor = (hex: string, mix = 0.2): string => {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#2a415f";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const nr = Math.round(r * (1 - mix))
    .toString(16)
    .padStart(2, "0");
  const ng = Math.round(g * (1 - mix))
    .toString(16)
    .padStart(2, "0");
  const nb = Math.round(b * (1 - mix))
    .toString(16)
    .padStart(2, "0");
  return `#${nr}${ng}${nb}`;
};

const getCenterAndSpanFromPaths = (paths: [number, number][][]): { center: [number, number] | null; span: number } => {
  if (!paths.length) return { center: null, span: 0 };
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let hasPoint = false;

  paths.forEach((path) => {
    path.forEach(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      hasPoint = true;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  if (!hasPoint) return { center: null, span: 0 };
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const span = Math.max(maxLng - minLng, maxLat - minLat);
  return { center, span };
};

const estimateFocusZoom = (span: number): number => {
  if (span <= 0.0015) return 14.2;
  if (span <= 0.003) return 13.8;
  if (span <= 0.006) return 13.4;
  if (span <= 0.012) return 13.0;
  if (span <= 0.024) return 12.4;
  return 11.8;
};

const getBasePolygonStyle = (
  color: string,
  isSelected: boolean,
  isSimilar: boolean,
  selectedFlash: boolean
): PolygonStyleConfig => {
  if (isSelected) {
    return {
      strokeColor: "#f2fbff",
      strokeWeight: selectedFlash ? 5.2 : 4.1,
      strokeOpacity: 1,
      fillColor: color,
      fillOpacity: selectedFlash ? 0.52 : 0.42,
    };
  }
  if (isSimilar) {
    const similarStroke = darkenColor(color, SIMILAR_STROKE_DARKEN);
    const similarGlow = darkenColor(color, SIMILAR_FILL_DARKEN);
    return {
      strokeColor: similarStroke,
      strokeWeight: SIMILAR_STROKE_WEIGHT,
      strokeOpacity: SIMILAR_STROKE_OPACITY,
      fillColor: similarGlow,
      fillOpacity: SIMILAR_FILL_OPACITY,
    };
  }
  return {
    strokeColor: brightenColor(color, BASE_STROKE_LIGHTEN),
    strokeWeight: BASE_STROKE_WEIGHT,
    strokeOpacity: BASE_STROKE_OPACITY,
    fillColor: brightenColor(color, BASE_FILL_LIGHTEN),
    fillOpacity: BASE_FILL_OPACITY,
  };
};

const getSimilarRingStyle = (baseColor: string, intensity = 0): PolygonStyleConfig => {
  const amount = clamp(intensity, 0, 1);
  const strokeColor = brightenColor(
    baseColor,
    clamp(SIMILAR_RING_STROKE_LIGHTEN + amount * SIMILAR_RING_STROKE_PULSE_LIGHTEN_BOOST, 0, 0.8)
  );
  const fillColor = brightenColor(
    baseColor,
    clamp(SIMILAR_RING_FILL_LIGHTEN + amount * SIMILAR_RING_FILL_PULSE_LIGHTEN_BOOST, 0, 0.72)
  );
  return {
    strokeColor,
    strokeWeight: SIMILAR_RING_STROKE_WEIGHT + amount * SIMILAR_RING_PULSE_STROKE_BOOST,
    strokeOpacity: clamp(SIMILAR_RING_STROKE_OPACITY + amount * SIMILAR_RING_PULSE_OPACITY_BOOST, 0, 1),
    fillColor,
    fillOpacity: clamp(SIMILAR_RING_FILL_OPACITY + amount * SIMILAR_RING_PULSE_FILL_BOOST, 0, 0.34),
  };
};

export function BaiduMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewCardRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<BMapAny | null>(null);
  const overlaysRef = useRef<any[]>([]);
  const poiOverlaysRef = useRef<any[]>([]);
  const similarFocusOverlaysRef = useRef<any[]>([]);
  const similarFocusEntriesRef = useRef<Map<string, any[]>>(new Map());
  const selectedFocusOverlaysRef = useRef<any[]>([]);
  const polygonEntriesRef = useRef<Map<string, any[]>>(new Map());
  const polygonPathsRef = useRef<Map<string, [number, number][][]>>(new Map());
  const colorByIdRef = useRef<Map<string, string>>(new Map());
  const hoverMetaByIdRef = useRef<Map<string, HoverMeta>>(new Map());
  const centerByIdRef = useRef<Map<string, [number, number]>>(new Map());
  const trajPointsRef = useRef<Array<{ id: string; lng: number; lat: number }>>([]);
  const trajPathOverlayRef = useRef<any | null>(null);
  const trajTailOverlayRef = useRef<any | null>(null);
  const trajMarkerOverlayRef = useRef<any | null>(null);
  const trajRadiusOverlayRef = useRef<any | null>(null);
  const lastFitNonceRef = useRef<number>(0);
  const viewportListenerRef = useRef<(() => void) | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusRunIdRef = useRef<number>(0);
  const sequenceTimerRef = useRef<number | null>(null);
  const sequenceStartRef = useRef<number>(0);
  const sequenceActiveRingIdsRef = useRef<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [selectedFlash, setSelectedFlash] = useState(false);
  const hoverHideTimerRef = useRef<number | null>(null);
  const hoverHideTokenRef = useRef<number>(0);
  const highlightModeRef = useRef<"click" | "hover">("click");
  const selectionSourceRef = useRef<"embedding-click" | "map-click" | "embedding-hover" | "map-hover" | null>(null);

  const {
    data,
    dataNonce,
    selectedId,
    similarIds,
    hoverPreviewId,
    hoverPreviewSimilarIds,
    highlightMode,
    selectionSource,
    selectionNonce,
    activeLabelField,
    compareMode,
    compareLabelTop,
    compareLabelBottom,
    mapColorSource,
    paletteId,
    labelColorMap,
    labelFields,
    baiduTheme,
    mapIs3d,
    embeddingTrajectoryEnabled,
    sequenceSpeed,
    poiData,
    poiVizMode,
    poiShowLabels,
    trajTimeline,
    trajPlayhead,
    trajActiveId,
    trajRadiusM,
    trajPoiCategoryField,
    mapLayerVisibility,
    mapViewport,
    setSelectedId,
    setHoverPreview,
    clearHoverPreview,
    setHoveredId,
    setMapViewport,
    setMapColorSource,
  } = useAppStore();

  const mapLabelField = useMemo(() => {
    if (!compareMode) return activeLabelField;
    if (mapColorSource === "compare-bottom") return compareLabelBottom;
    if (mapColorSource === "compare-top") return compareLabelTop;
    return activeLabelField;
  }, [activeLabelField, compareLabelBottom, compareLabelTop, compareMode, mapColorSource]);

  const mapLabelColorMap = useMemo(() => {
    if (mapLabelField === activeLabelField) return labelColorMap;
    return buildLabelColorMap(data, mapLabelField, paletteId, {});
  }, [activeLabelField, data, labelColorMap, mapLabelField, paletteId]);

  const activeSelectedId = hoverPreviewId ?? selectedId;
  const activeSimilarIds = hoverPreviewId ? hoverPreviewSimilarIds : similarIds;
  const visibleSimilarIds = useMemo(() => {
    const ids = new Set(activeSimilarIds);
    if (activeSelectedId) ids.delete(activeSelectedId);
    return Array.from(ids).slice(0, MAP_VISUAL_TOPK);
  }, [activeSelectedId, activeSimilarIds]);
  const similarSet = useMemo(() => new Set(visibleSimilarIds), [visibleSimilarIds]);
  const sequenceIds = useMemo(() => {
    if (!activeSelectedId) return [];
    return [activeSelectedId, ...visibleSimilarIds];
  }, [activeSelectedId, visibleSimilarIds]);

  useEffect(() => {
    highlightModeRef.current = highlightMode;
  }, [highlightMode]);

  useEffect(() => {
    selectionSourceRef.current = selectionSource;
  }, [selectionSource]);

  const scheduleHoverHide = () => {
    hoverHideTokenRef.current += 1;
    const token = hoverHideTokenRef.current;
    if (hoverHideTimerRef.current !== null) {
      window.clearTimeout(hoverHideTimerRef.current);
    }
    hoverHideTimerRef.current = window.setTimeout(() => {
      if (hoverHideTokenRef.current !== token) return;
      setHoverState(null);
      const keepMapHoverLocked = highlightModeRef.current === "hover" && selectionSourceRef.current === "map-hover";
      if (!keepMapHoverLocked) {
        setHoveredId(null);
        if (selectionSourceRef.current === "map-hover") {
          clearHoverPreview();
        }
      }
      hoverHideTimerRef.current = null;
    }, 130);
  };

  const showHoverForId = (id: string, evt?: any) => {
    if (!id) return;
    hoverHideTokenRef.current += 1;
    if (hoverHideTimerRef.current !== null) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    const map = mapRef.current;
    const container = containerRef.current;
    const card = viewCardRef.current;
    if (!map || !container || !card) return;

    let px: number | null = null;
    let py: number | null = null;
    const domEvt = evt?.domEvent;
    if (Number.isFinite(domEvt?.clientX) && Number.isFinite(domEvt?.clientY)) {
      const containerRect = container.getBoundingClientRect();
      px = domEvt.clientX - containerRect.left;
      py = domEvt.clientY - containerRect.top;
    } else if (evt?.latlng && typeof map.pointToPixel === "function") {
      try {
        const pixel = map.pointToPixel(evt.latlng);
        const x = Number(pixel?.x);
        const y = Number(pixel?.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          px = x;
          py = y;
        }
      } catch {
        // ignore and continue center fallback
      }
    }

    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      const center = centerByIdRef.current.get(id);
      const win = window as any;
      const BMapGL = win.BMapGL;
      if (center && BMapGL) {
        try {
          const pixel = map.pointToPixel(new BMapGL.Point(center[0], center[1]));
          const x = Number(pixel?.x);
          const y = Number(pixel?.y);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            px = x;
            py = y;
          }
        } catch {
          // ignore
        }
      }
    }

    if (px === null || py === null) return;
    const meta = hoverMetaByIdRef.current.get(id);
    const offsetLeft = container.offsetLeft;
    const offsetTop = container.offsetTop;
    const cardW = card.clientWidth;
    const cardH = card.clientHeight;
    const tooltipW = 186;
    const tooltipH = 96;
    const desiredX = offsetLeft + px + 14;
    const desiredY = offsetTop + py + 14;
    const x = clamp(desiredX, 8, Math.max(8, cardW - tooltipW - 8));
    const y = clamp(desiredY, 8, Math.max(8, cardH - tooltipH - 8));

    setHoveredId(id);
    if (highlightModeRef.current === "hover") {
      setHoverPreview(id, "map-hover");
    }
    setHoverState({
      x,
      y,
      id,
      label: meta?.label ?? "-",
      cluster: meta?.cluster ?? "-",
      metric: meta?.metric ?? "-",
    });
  };

  useEffect(() => {
    if (!activeSelectedId) {
      setSelectedFlash(false);
      return;
    }
    setSelectedFlash(true);
    const timer = window.setTimeout(() => setSelectedFlash(false), 420);
    return () => window.clearTimeout(timer);
  }, [activeSelectedId]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!BAIDU_AK) {
      setError("未配置 VITE_BAIDU_AK");
      return;
    }

    let mounted = true;
    loadBaiduScript(BAIDU_AK)
      .then(() => {
        if (!mounted || !containerRef.current) return;
        const win = window as any;
        const BMapGL = win.BMapGL;
        if (!BMapGL) throw new Error("BMapGL not found after script load");

        if (win.BMapGL && win.BMAP_COORD_GCJ02) {
          win.BMapGL.coordType = win.BMAP_COORD_GCJ02;
        }

        const map = new BMapGL.Map(containerRef.current, {
          enableRotate: true,
          enableTilt: true,
        });
        mapRef.current = map;

        const initialCenter = mapViewport?.center ?? [113.93, 22.54];
        const initialZoomCandidate = mapViewport?.zoom;
        const initialZoom = Number.isFinite(initialZoomCandidate) ? Number(initialZoomCandidate) : 12;
        const center = new BMapGL.Point(initialCenter[0], initialCenter[1]);
        map.centerAndZoom(center, initialZoom);
        map.enableScrollWheelZoom(true);
        map.disableDoubleClickZoom();
        map.disableContinuousZoom?.();
        map.disableInertialDragging?.();

        const initialState = useAppStore.getState();
        applyBaiduTheme(map, initialState.baiduTheme, initialState.mapLayerVisibility.basemap);

        map.setHeading(mapIs3d ? 64.5 : 0);
        map.setTilt(mapIs3d ? 60 : 0);

        const updateViewport = () => {
          try {
            const centerPoint = map.getCenter?.();
            const zoom = Number(map.getZoom?.());
            const bearing = Number(map.getHeading?.() ?? 0);
            const pitch = Number(map.getTilt?.() ?? 0);
            if (!centerPoint || !Number.isFinite(centerPoint.lng) || !Number.isFinite(centerPoint.lat)) return;
            setMapViewport({
              center: [centerPoint.lng, centerPoint.lat],
              zoom: Number.isFinite(zoom) ? zoom : initialZoom,
              pitch: Number.isFinite(pitch) ? pitch : 0,
              bearing: Number.isFinite(bearing) ? bearing : 0,
            });
          } catch {
            // ignore
          }
        };
        viewportListenerRef.current = updateViewport;
        map.addEventListener("moveend", updateViewport);
        map.addEventListener("zoomend", updateViewport);
        map.addEventListener("dragend", updateViewport);
        updateViewport();

        setReady(true);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError((err as Error).message);
      });

    return () => {
      mounted = false;
      if (hoverHideTimerRef.current !== null) {
        window.clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = null;
      }
      if (focusTimerRef.current !== null) {
        window.cancelAnimationFrame(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      focusRunIdRef.current += 1;
      if (sequenceTimerRef.current !== null) {
        window.clearInterval(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
      clearOverlays(mapRef.current, overlaysRef.current);
      clearOverlays(mapRef.current, similarFocusOverlaysRef.current);
      clearOverlays(mapRef.current, selectedFocusOverlaysRef.current);
      if (mapRef.current) {
        try {
          if (viewportListenerRef.current) {
            mapRef.current.removeEventListener?.("moveend", viewportListenerRef.current);
            mapRef.current.removeEventListener?.("zoomend", viewportListenerRef.current);
            mapRef.current.removeEventListener?.("dragend", viewportListenerRef.current);
          }
        } catch {
          // ignore
        }
      }
      viewportListenerRef.current = null;
      polygonEntriesRef.current.clear();
      similarFocusEntriesRef.current.clear();
      polygonPathsRef.current.clear();
      colorByIdRef.current.clear();
      hoverMetaByIdRef.current.clear();
      centerByIdRef.current.clear();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyBaiduTheme(map, baiduTheme, mapLayerVisibility.basemap);
  }, [baiduTheme, mapLayerVisibility.basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setHeading(mapIs3d ? 64.5 : 0);
      map.setTilt(mapIs3d ? 60 : 0);
      const centerPoint = map.getCenter?.();
      const zoom = Number(map.getZoom?.());
      const bearing = Number(map.getHeading?.() ?? 0);
      const pitch = Number(map.getTilt?.() ?? 0);
      if (centerPoint && Number.isFinite(centerPoint.lng) && Number.isFinite(centerPoint.lat)) {
        setMapViewport({
          center: [centerPoint.lng, centerPoint.lat],
          zoom: Number.isFinite(zoom) ? zoom : 12,
          pitch: Number.isFinite(pitch) ? pitch : 0,
          bearing: Number.isFinite(bearing) ? bearing : 0,
        });
      }
    } catch {
      // ignore
    }
  }, [mapIs3d, ready, setMapViewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;

    clearOverlays(map, overlaysRef.current);
    clearOverlays(map, poiOverlaysRef.current);
    clearOverlays(map, similarFocusOverlaysRef.current);
    clearOverlays(map, selectedFocusOverlaysRef.current);
    polygonEntriesRef.current.clear();
    similarFocusEntriesRef.current.clear();
    polygonPathsRef.current.clear();
    colorByIdRef.current.clear();
    hoverMetaByIdRef.current.clear();
    centerByIdRef.current.clear();
    trajPointsRef.current = [];
    trajPathOverlayRef.current = null;
    trajTailOverlayRef.current = null;
    trajMarkerOverlayRef.current = null;
    trajRadiusOverlayRef.current = null;

    if (!mapLayerVisibility.overlay) return;
    if (!data || !Array.isArray(data.features) || data.features.length === 0) return;

    const featureById = new Map<string, GeoFeature>();
    data.features.forEach((feature) => {
      const id = String(feature.properties?.id ?? "");
      if (!id) return;
      featureById.set(id, feature);
    });

    const hasTrajPoints = data.features.some((feature) => (feature.properties as any)?.feature_role === "traj_point");
    if (hasTrajPoints) {
      const ids = trajTimeline.length > 0 ? trajTimeline : Array.from(featureById.keys());
      const ordered: Array<{ id: string; lng: number; lat: number }> = [];
      ids.forEach((id) => {
        const feature = featureById.get(id);
        if (!feature) return;
        if ((feature.properties as any)?.feature_role !== "traj_point") return;
        if (feature.geometry?.type !== "Point") return;
        const coords: any = (feature.geometry as any)?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        ordered.push({ id, lng, lat });
      });
      if (ordered.length === 0) return;
      trajPointsRef.current = ordered;

      const pathPoints = ordered.map((p) => new BMapGL.Point(p.lng, p.lat));
      const path = new BMapGL.Polyline(pathPoints, {
        strokeColor: "#55e6ff",
        strokeWeight: 4,
        strokeOpacity: 0.85,
      });
      map.addOverlay(path);
      overlaysRef.current.push(path);
      trajPathOverlayRef.current = path;

      const tail = new BMapGL.Polyline([pathPoints[0]], {
        strokeColor: "#42f6c7",
        strokeWeight: 6,
        strokeOpacity: 0.9,
      });
      map.addOverlay(tail);
      overlaysRef.current.push(tail);
      trajTailOverlayRef.current = tail;

      const marker = new BMapGL.Marker(pathPoints[0]);
      marker.addEventListener("click", () => {
        const state = useAppStore.getState();
        if (state.highlightMode !== "click") return;
        const list = trajPointsRef.current;
        if (list.length === 0) return;
        const idx = clamp(state.trajPlayhead, 0, list.length - 1);
        const id = list[idx]?.id;
        if (id) void state.setSelectedId(id, "map-click");
      });
      map.addOverlay(marker);
      overlaysRef.current.push(marker);
      trajMarkerOverlayRef.current = marker;

      const circle = new BMapGL.Circle(pathPoints[0], trajRadiusM, {
        strokeColor: "rgba(85,230,255,0.75)",
        strokeWeight: 2,
        strokeOpacity: 0.7,
        fillColor: "rgba(85,230,255,0.10)",
        fillOpacity: 0.25,
      });
      map.addOverlay(circle);
      overlaysRef.current.push(circle);
      trajRadiusOverlayRef.current = circle;

      return;
    }

    const nextEntries = new Map<string, any[]>();
    const nextPaths = new Map<string, [number, number][][]>();
    const nextColors = new Map<string, string>();
    const nextMeta = new Map<string, HoverMeta>();
    const nextCenters = new Map<string, [number, number]>();

    data.features.forEach((feature) => {
      const props = feature.properties ?? {};
      const id = String(props.id ?? "");
      if (!id) return;
      const labelValue = getFeatureLabelValue(props, mapLabelField);
      const color = mapLabelColorMap[labelValue] ?? "#5B8CFF";
      nextColors.set(id, color);
      const cluster =
        props.cluster_id !== undefined && props.cluster_id !== null ? String(props.cluster_id) : "-";
      const metricRaw = props.metric;
      const metric = typeof metricRaw === "number" ? metricRaw.toFixed(3) : String(metricRaw ?? "-");
      nextMeta.set(id, { label: labelValue, cluster, metric });

      if (feature.geometry?.type !== "Polygon" && feature.geometry?.type !== "MultiPolygon") return;
      const paths: [number, number][][] = [];
      const rawCoords = feature.geometry.coordinates;
      if (feature.geometry.type === "Polygon") {
        (rawCoords as any[]).forEach((ring: any) => {
          const path: [number, number][] = [];
          collectLngLat(ring, path);
          if (path.length > 0) paths.push(path);
        });
      } else {
        (rawCoords as any[]).forEach((polygon: any) => {
          (polygon as any[]).forEach((ring: any) => {
            const path: [number, number][] = [];
            collectLngLat(ring, path);
            if (path.length > 0) paths.push(path);
          });
        });
      }

      if (paths.length === 0) return;
      const centerPts: [number, number][] = [];
      paths.forEach((path) => {
        path.forEach((p) => centerPts.push(p));
      });
      if (centerPts.length > 0) {
        const sx = centerPts.reduce((acc, p) => acc + p[0], 0);
        const sy = centerPts.reduce((acc, p) => acc + p[1], 0);
        nextCenters.set(id, [sx / centerPts.length, sy / centerPts.length]);
      }
      const existingPolygons = nextEntries.get(id) ?? [];
      const existingPaths = nextPaths.get(id) ?? [];

      paths.forEach((path) => {
        const polygon = new BMapGL.Polygon(
          path.map((p) => new BMapGL.Point(p[0], p[1])),
          {
            strokeColor: color,
            strokeWeight: 1.2,
            strokeOpacity: 0.88,
            fillColor: color,
            fillOpacity: 0.3,
          }
        );

        polygon.addEventListener("click", (evt: any) => {
          evt?.domEvent?.stopPropagation?.();
          evt?.domEvent?.preventDefault?.();
          if (highlightMode === "click") {
            void setSelectedId(id, "map-click");
          }
        });

        polygon.addEventListener("mouseover", (evt: any) => {
          showHoverForId(id, evt);
        });
        polygon.addEventListener("mousemove", (evt: any) => {
          showHoverForId(id, evt);
        });

        polygon.addEventListener("mouseout", () => {
          scheduleHoverHide();
        });

        map.addOverlay(polygon);
        overlaysRef.current.push(polygon);
        existingPolygons.push(polygon);
        existingPaths.push(path);
      });

      nextEntries.set(id, existingPolygons);
      nextPaths.set(id, existingPaths);
    });

    polygonEntriesRef.current = nextEntries;
    polygonPathsRef.current = nextPaths;
    colorByIdRef.current = nextColors;
    hoverMetaByIdRef.current = nextMeta;
    centerByIdRef.current = nextCenters;
  }, [
    data,
    highlightMode,
    mapLabelColorMap,
    mapLabelField,
    mapLayerVisibility.overlay,
    ready,
    setSelectedId,
    trajRadiusM,
    trajTimeline,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;

    clearOverlays(map, poiOverlaysRef.current);

    if (!mapLayerVisibility.overlay) return;
    if (!poiData || !Array.isArray(poiData.features) || poiData.features.length === 0) return;
    if (poiVizMode === "off") return;
    if (!data || !Array.isArray(data.features) || data.features.length === 0) return;

    const poiById = new Map<string, any>();
    poiData.features.forEach((f: any) => {
      const id = String(f?.properties?.id ?? "");
      if (id) poiById.set(id, f);
    });

    let visiblePois: any[] = [];
    if (poiVizMode === "all") {
      visiblePois = poiData.features.slice(0, 8000);
    } else {
      const activeTrajId = trajTimeline.length > 0 ? trajTimeline[clamp(trajPlayhead, 0, trajTimeline.length - 1)] : null;
      const activeTrajFeature = activeTrajId
        ? data.features.find((f: any) => String(f?.properties?.id ?? "") === String(activeTrajId))
        : null;
      const ids: any = activeTrajFeature?.properties?.poi_ids;
      if (Array.isArray(ids) && ids.length > 0) {
        const set = new Set(ids.map((x: any) => String(x)));
        visiblePois = Array.from(set)
          .map((id) => poiById.get(id))
          .filter(Boolean);
      } else {
        // Fallback: no poi_ids on traj point (older backend result); show nothing.
        visiblePois = [];
      }
    }

    if (visiblePois.length === 0) return;

    const poiColorMap = buildLabelColorMap(
      { type: "FeatureCollection", features: visiblePois } as any,
      trajPoiCategoryField || "category",
      paletteId,
      {}
    );

    const byCategory = new Map<string, Array<[number, number]>>();
    const metaByCoord = new Map<string, { name: string; category: string; id: string }>();
    visiblePois.forEach((f: any) => {
      if (f?.geometry?.type !== "Point") return;
      const coords = f.geometry.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      const props = f.properties ?? {};
      const category = String(props?.[trajPoiCategoryField || "category"] ?? "unknown");
      const name = String(props?.name ?? props?.id ?? "POI");
      const id = String(props?.id ?? "");
      const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
      metaByCoord.set(key, { name, category, id });
      const list = byCategory.get(category) ?? [];
      list.push([lng, lat]);
      byCategory.set(category, list);
    });

    byCategory.forEach((points, category) => {
      if (points.length === 0) return;
      const color = poiColorMap[category] ?? "#ffcc66";
      const bPoints = points.map((p) => new BMapGL.Point(p[0], p[1]));

      const openPoiInfo = (lng: number, lat: number, meta?: { name: string; category: string }) => {
        const safeName = meta?.name ? String(meta.name) : "POI";
        const safeCat = meta?.category ? String(meta.category) : String(category);
        const html = `<div style="font-size:12px;line-height:1.35;"><div><b>${safeName}</b></div><div>${safeCat}</div></div>`;
        try {
          const info = new BMapGL.InfoWindow(html, { width: 220, height: 76, title: "POI" });
          map.openInfoWindow(info, new BMapGL.Point(lng, lat));
        } catch {
          // ignore
        }
      };

      // Prefer PointCollection for performance; fallback to Markers if unavailable.
      if (typeof BMapGL.PointCollection === "function") {
        const pc = new BMapGL.PointCollection(bPoints, {
          size: 6,
          color,
          opacity: 0.86,
        });
        pc.addEventListener("click", (evt: any) => {
          const p = evt?.point;
          const lng = Number(p?.lng);
          const lat = Number(p?.lat);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
          const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
          const meta = metaByCoord.get(key);
          openPoiInfo(lng, lat, meta ? { name: meta.name, category: meta.category } : undefined);
        });
        map.addOverlay(pc);
        poiOverlaysRef.current.push(pc);
      } else {
        const cap = poiVizMode === "nearby" ? 300 : 1200;
        points.slice(0, cap).forEach((p) => {
          const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
          const meta = metaByCoord.get(key);
          const marker = new BMapGL.Marker(new BMapGL.Point(p[0], p[1]));
          marker.addEventListener("click", () => openPoiInfo(p[0], p[1], meta ? { name: meta.name, category: meta.category } : undefined));
          map.addOverlay(marker);
          poiOverlaysRef.current.push(marker);
        });
      }

      // Labels are only reasonable for small sets.
      if (
        poiShowLabels &&
        poiVizMode === "nearby" &&
        typeof BMapGL.Label === "function" &&
        typeof BMapGL.Size === "function" &&
        points.length <= 60
      ) {
        points.forEach((p) => {
          const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
          const meta = metaByCoord.get(key);
          if (!meta) return;
          const label = new BMapGL.Label(meta.category, {
            position: new BMapGL.Point(p[0], p[1]),
            offset: new BMapGL.Size(10, -12),
          });
          label.setStyle({
            color: "#f2fbff",
            backgroundColor: "rgba(10,16,26,0.66)",
            border: "1px solid rgba(85,230,255,0.35)",
            borderRadius: "8px",
            padding: "2px 6px",
            fontSize: "11px",
            lineHeight: "14px",
            whiteSpace: "nowrap",
          });
          map.addOverlay(label);
          poiOverlaysRef.current.push(label);
        });
      }
    });
  }, [
    data,
    mapLayerVisibility.overlay,
    paletteId,
    poiData,
    poiShowLabels,
    poiVizMode,
    ready,
    trajPlayhead,
    trajPoiCategoryField,
    trajTimeline,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!mapLayerVisibility.overlay) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;
    const list = trajPointsRef.current;
    if (list.length === 0) return;
    const idx = clamp(trajPlayhead, 0, list.length - 1);
    const row = list[idx];
    if (!row) return;
    const point = new BMapGL.Point(row.lng, row.lat);
    trajMarkerOverlayRef.current?.setPosition?.(point);
    if (trajTailOverlayRef.current?.setPath) {
      trajTailOverlayRef.current.setPath(list.slice(0, idx + 1).map((p) => new BMapGL.Point(p.lng, p.lat)));
    }
    if (trajRadiusOverlayRef.current?.setCenter) {
      trajRadiusOverlayRef.current.setCenter(point);
    }
    if (trajRadiusOverlayRef.current?.setRadius) {
      trajRadiusOverlayRef.current.setRadius(trajRadiusM);
    }
  }, [mapLayerVisibility.overlay, ready, trajPlayhead, trajRadiusM]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!mapLayerVisibility.overlay) return;

    polygonEntriesRef.current.forEach((polygons, id) => {
      const color = colorByIdRef.current.get(id) ?? "#5B8CFF";
      const isSelected = activeSelectedId === id;
      const isSimilar = similarSet.has(id);
      const style = getBasePolygonStyle(color, isSelected, isSimilar, selectedFlash);

      polygons.forEach((polygon) => applyPolygonStyle(polygon, style));
    });
  }, [
    activeSelectedId,
    mapLayerVisibility.overlay,
    ready,
    selectedFlash,
    similarSet,
  ]);

  const applySimilarRingStyleForId = useCallback((id: string, intensity = 0) => {
    const rings = similarFocusEntriesRef.current.get(id);
    if (!rings || rings.length === 0) return;
    const baseColor = colorByIdRef.current.get(id) ?? "#5B8CFF";
    const style = getSimilarRingStyle(baseColor, intensity);
    rings.forEach((ring) => applyPolygonStyle(ring, style));
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    clearOverlays(map, similarFocusOverlaysRef.current);
    similarFocusEntriesRef.current.clear();
    if (!mapLayerVisibility.overlay || visibleSimilarIds.length === 0) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;

    visibleSimilarIds.forEach((id) => {
      const paths = polygonPathsRef.current.get(id);
      if (!paths || paths.length === 0) return;
      const rings: any[] = [];
      paths.forEach((path) => {
        const points = path.map((p) => new BMapGL.Point(p[0], p[1]));
        const baseColor = colorByIdRef.current.get(id) ?? "#5B8CFF";
        const ring = new BMapGL.Polygon(points, getSimilarRingStyle(baseColor, 0));
        ring.addEventListener("mouseover", (evt: any) => showHoverForId(id, evt));
        ring.addEventListener("mousemove", (evt: any) => showHoverForId(id, evt));
        ring.addEventListener("mouseout", scheduleHoverHide);
        ring.addEventListener("click", (evt: any) => {
          evt?.domEvent?.stopPropagation?.();
          evt?.domEvent?.preventDefault?.();
          if (highlightMode === "click") {
            void setSelectedId(id, "map-click");
          }
        });
        map.addOverlay(ring);
        rings.push(ring);
        similarFocusOverlaysRef.current.push(ring);
      });
      if (rings.length > 0) {
        similarFocusEntriesRef.current.set(id, rings);
      }
    });
  }, [highlightMode, mapLayerVisibility.overlay, ready, setSelectedId, visibleSimilarIds]);

  useEffect(() => {
    sequenceStartRef.current = performance.now();
  }, [sequenceIds]);

  useEffect(() => {
    if (sequenceTimerRef.current !== null) {
      window.clearInterval(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    const restoreAll = () => {
      sequenceActiveRingIdsRef.current.forEach((_, id) => applySimilarRingStyleForId(id, 0));
      sequenceActiveRingIdsRef.current.clear();
    };

    if (!ready || !mapLayerVisibility.overlay || !embeddingTrajectoryEnabled || visibleSimilarIds.length === 0) {
      restoreAll();
      return;
    }

    const tick = () => {
      if (!mapRef.current) return;
      const now = performance.now();
      const sequenceTime = (now - sequenceStartRef.current) / 1000;
      const totalSegments = Math.max(1, sequenceIds.length - 1);
      const head = (sequenceTime * sequenceSpeed) % 1;
      const headPos = head * totalSegments;
      const segment = Math.min(totalSegments - 1, Math.floor(headPos));
      const pulse = Math.sin(head * Math.PI);
      const pulseBase = PULSE_BASE_INTENSITY + pulse * PULSE_DYNAMIC_INTENSITY;
      const nextActive = new Map<string, number>();
      const activeSimilarId = sequenceIds[Math.min(sequenceIds.length - 1, segment + 1)];
      if (activeSimilarId && similarFocusEntriesRef.current.has(activeSimilarId)) {
        nextActive.set(activeSimilarId, clamp(0.28 + pulseBase, 0, 1));
      }

      sequenceActiveRingIdsRef.current.forEach((_, id) => {
        if (!nextActive.has(id)) applySimilarRingStyleForId(id, 0);
      });
      nextActive.forEach((intensity, id) => {
        applySimilarRingStyleForId(id, intensity);
      });
      sequenceActiveRingIdsRef.current = nextActive;
    };

    tick();
    sequenceTimerRef.current = window.setInterval(tick, PULSE_INTERVAL_MS);

    return () => {
      if (sequenceTimerRef.current !== null) {
        window.clearInterval(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
      restoreAll();
    };
  }, [
    applySimilarRingStyleForId,
    embeddingTrajectoryEnabled,
    mapLayerVisibility.overlay,
    ready,
    sequenceIds,
    visibleSimilarIds.length,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    clearOverlays(map, selectedFocusOverlaysRef.current);
    if (!mapLayerVisibility.overlay || !activeSelectedId) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;
    const paths = polygonPathsRef.current.get(activeSelectedId);
    const color = colorByIdRef.current.get(activeSelectedId) ?? "#5B8CFF";
    const glow = brightenColor(color, 0.44);
    if (!paths || paths.length === 0) return;

    paths.forEach((path) => {
      const points = path.map((p) => new BMapGL.Point(p[0], p[1]));
      const glowFill = new BMapGL.Polygon(points, {
        strokeColor: glow,
        strokeWeight: selectedFlash ? 2.2 : 1.8,
        strokeOpacity: selectedFlash ? 0.76 : 0.58,
        fillColor: glow,
        fillOpacity: selectedFlash ? 0.24 : 0.14,
      });
      const outer = new BMapGL.Polygon(points, {
        strokeColor: "#f7fcff",
        strokeWeight: selectedFlash ? 9.6 : 7.2,
        strokeOpacity: 0.97,
        fillOpacity: 0,
      });
      const inner = new BMapGL.Polygon(points, {
        strokeColor: glow,
        strokeWeight: selectedFlash ? 5.6 : 4.2,
        strokeOpacity: 1,
        fillOpacity: 0,
      });

      [glowFill, outer, inner].forEach((overlay) => {
        overlay.addEventListener("mouseover", (evt: any) => showHoverForId(activeSelectedId, evt));
        overlay.addEventListener("mousemove", (evt: any) => showHoverForId(activeSelectedId, evt));
        overlay.addEventListener("mouseout", scheduleHoverHide);
        overlay.addEventListener("click", (evt: any) => {
          evt?.domEvent?.stopPropagation?.();
          evt?.domEvent?.preventDefault?.();
          if (highlightMode === "click") {
            void setSelectedId(activeSelectedId, "map-click");
          }
        });
      });

      map.addOverlay(glowFill);
      map.addOverlay(outer);
      map.addOverlay(inner);
      selectedFocusOverlaysRef.current.push(glowFill, outer, inner);
    });
  }, [activeSelectedId, highlightMode, mapLayerVisibility.overlay, ready, selectedFlash, setSelectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectionSource !== "embedding-click") return;
    if (!selectedId || selectionNonce <= 0) return;
    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;

    const paths = polygonPathsRef.current.get(selectedId) ?? [];
    const { center: centerFromPaths, span } = getCenterAndSpanFromPaths(paths);
    const center =
      centerFromPaths ??
      centerByIdRef.current.get(selectedId) ??
      getFeatureCenter(data?.features.find((feature) => feature.properties.id === selectedId));
    if (!center) return;

    const point = new BMapGL.Point(center[0], center[1]);
    const viewportPoints = paths.flatMap((path) => path.map((p) => new BMapGL.Point(p[0], p[1])));
    let finalCenter = point;
    let targetZoom = clamp(estimateFocusZoom(span), 11.0, 13.8);
    if (viewportPoints.length > 0 && typeof map.getViewport === "function") {
      try {
        const viewport = map.getViewport(viewportPoints);
        const viewportZoom = Number(viewport?.zoom);
        const viewportCenter = viewport?.center;
        if (Number.isFinite(viewportZoom)) {
          targetZoom = clamp(viewportZoom - 0.35, 11.0, 13.8);
        }
        if (Number.isFinite(viewportCenter?.lng) && Number.isFinite(viewportCenter?.lat)) {
          finalCenter = new BMapGL.Point(viewportCenter.lng, viewportCenter.lat);
        }
      } catch {
        // ignore
      }
    }
    const currentZoom = Number(map.getZoom?.());

    if (focusTimerRef.current !== null) {
      window.cancelAnimationFrame(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    const runId = focusRunIdRef.current + 1;
    focusRunIdRef.current = runId;

    try {
      const startCenter = map.getCenter?.();
      const startLng = Number.isFinite(startCenter?.lng) ? startCenter.lng : finalCenter.lng;
      const startLat = Number.isFinite(startCenter?.lat) ? startCenter.lat : finalCenter.lat;
      const startZoom = Number.isFinite(currentZoom) ? currentZoom : targetZoom;
      const finalLng = finalCenter.lng;
      const finalLat = finalCenter.lat;
      const totalDurationMs = 560;
      const startAt = performance.now();

      const tick = (now: number) => {
        if (focusRunIdRef.current !== runId) return;
        const elapsed = now - startAt;
        if (elapsed >= totalDurationMs) {
          setMapViewImmediate(map, finalCenter, targetZoom);
          focusTimerRef.current = null;
          return;
        }

        const p = easeInOutCubic(clamp(elapsed / totalDurationMs, 0, 1));
        const lng = lerp(startLng, finalLng, p);
        const lat = lerp(startLat, finalLat, p);
        const zoom = lerp(startZoom, targetZoom, p);

        const centerPoint = new BMapGL.Point(lng, lat);
        setMapViewImmediate(map, centerPoint, zoom);
        if (focusRunIdRef.current !== runId) return;
        focusTimerRef.current = window.requestAnimationFrame(tick);
      };

      focusTimerRef.current = window.requestAnimationFrame(tick);
    } catch {
      // ignore
    }
    return () => {
      if (focusRunIdRef.current === runId) {
        focusRunIdRef.current += 1;
      }
      if (focusTimerRef.current !== null) {
        window.cancelAnimationFrame(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [data, ready, selectedId, selectionNonce, selectionSource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!data || !Array.isArray(data.features) || data.features.length === 0) return;
    if (!dataNonce || dataNonce === lastFitNonceRef.current) return;

    const win = window as any;
    const BMapGL = win.BMapGL;
    if (!BMapGL) return;

    const viewportPoints: any[] = [];
    data.features.forEach((feature) => {
      const center = getFeatureCenter(feature);
      if (center) viewportPoints.push(new BMapGL.Point(center[0], center[1]));
    });

    if (viewportPoints.length > 0) {
      try {
        map.setViewport(viewportPoints);
        lastFitNonceRef.current = dataNonce;
      } catch {
        // ignore
      }
    }
  }, [data, dataNonce, ready]);

  const topLabelName = useMemo(
    () => labelFields.find((item) => item.field === compareLabelTop)?.label ?? compareLabelTop,
    [compareLabelTop, labelFields]
  );
  const bottomLabelName = useMemo(
    () => labelFields.find((item) => item.field === compareLabelBottom)?.label ?? compareLabelBottom,
    [compareLabelBottom, labelFields]
  );

  return (
    <div className="view-card" ref={viewCardRef}>
      <div className="view-header">
        <div>地理空间 · Baidu Map WebGL</div>
        {compareMode && (
          <label className="map-color-source">
            <span>配色</span>
            <select value={mapColorSource} onChange={(e) => setMapColorSource(e.target.value as MapColorSource)}>
              <option value="compare-top">跟随上层（{topLabelName}）</option>
              <option value="compare-bottom">跟随下层（{bottomLabelName}）</option>
              <option value="active">跟随当前标签（{activeLabelField}）</option>
            </select>
          </label>
        )}
      </div>
      <div className="map-container" ref={containerRef} />
      {error && <div className="empty-state">百度地图加载失败：{error}</div>}
      {hoverState && (
        <div className="map-tooltip" style={{ left: hoverState.x, top: hoverState.y }}>
          <div className="tooltip-row"><b>ID</b> {hoverState.id || "-"}</div>
          <div className="tooltip-row"><b>{mapLabelField}</b> {hoverState.label}</div>
          <div className="tooltip-row"><b>cluster</b> {hoverState.cluster}</div>
          <div className="tooltip-row"><b>metric</b> {hoverState.metric}</div>
        </div>
      )}
    </div>
  );
}
