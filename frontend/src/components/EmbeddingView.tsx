import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useAppStore } from "../store/useAppStore";
import type { GeoFeature } from "../types";
import { buildLabelColorMap, DEFAULT_CELL_COLOR, getCellColor, getFeatureLabelValue } from "../utils/colors";

interface CellPoint {
  id: string;
  name: string;
  position: [number, number, number];
  metric: number;
  info: string;
  [key: string]: unknown;
}

const getCellPoints = (features: GeoFeature[] | undefined, force2D: boolean): CellPoint[] => {
  if (!features) return [];
  return features
    .flatMap((feature) => {
      const reduced = feature.properties.reduction_embedding;
      const legacy = feature.properties.vec_3d;
      const source = Array.isArray(reduced) ? reduced : legacy;
      if (!Array.isArray(source) || source.length < 2) return [];
      const x = Number(source[0]);
      const y = Number(source[1]);
      const z = source.length >= 3 ? Number(source[2]) : 0;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return [];
      return [
        {
          id: feature.properties.id,
          name: feature.properties.name || feature.properties.id,
          position: [x, y, force2D ? 0 : z],
          metric: feature.properties.metric ?? 0,
          info: feature.properties.info ?? feature.properties.class ?? "未知",
        },
      ];
    });
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  if (value.length !== 6) return [0.5, 0.5, 0.5];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const EMBEDDING_SCALE = 20; // 3D坐标整体缩放系数（越大越分散）
const SELECTED_BOOST = 2.2; // 选中点亮度提升强度
const SIMILAR_BOOST = 0.22; // 相似点基础亮度提升
const SIMILAR_PULSE_BOOST = 0.6; // 相似点脉冲亮度增量
const SIMILAR_PULSE_BASE = 0.45; // 相似点脉冲最小值
const PULSE_SPEED = 10.5; // 全局脉冲速度
const POINT_SIZE = 8.2; // 点精灵基础尺寸（像素）
const CORE_RADIUS = 0.33; // 点核心半径（越小核心越尖）
const HALO_BASE_RADIUS = 0.43; // 光晕基础半径
const HALO_MAX_RADIUS = 1; // 光晕最大半径
const HALO_BASE_ALPHA = 0.02; // 光晕基础透明度
const HALO_PULSE_ALPHA = 0.95; // 光晕脉冲透明度增量
const CORE_ALPHA = 0.66; // 点核心亮度系数
const BASE_COLOR_SCALE = 0.75; // 基础颜色整体压暗比例
const FLASH_RADIUS_BOOST = 0.48; // 闪光时光晕半径提升
const FLASH_ALPHA_BOOST = 0.6; // 闪光时光晕透明度提升
const SIZE_PULSE_AMP = 0.34; // 脉冲时点尺寸增幅
const FLASH_SIZE_BOOST = 0.34; // 闪光时点尺寸增幅
const DEFAULT_PIXEL_RATIO = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1); // 像素比上限
const HOVER_PICK_THRESHOLD = 3.4; // 点云命中阈值（越大越容易点中）
const HOVER_CLEAR_DELAY_MS = 140; // 悬浮未命中后的延迟清理时间
const HOVER_HOLD_MS = 110; // 最近命中后的最短保持时间，避免边缘抖动
const COLOR_BOOST_FACTOR = 1.6; // 颜色增亮系数
const LINE_SEGMENTS = 16; // 曲线分段数（越大越平滑）
const LINE_MAX_LIFT = 8; // 曲线拱起高度上限
const LINE_TRAIL = 0.06; // 尾迹长度（0~1）
const LINE_BASE_ALPHA = 0.12; // 线条基础透明度
const LINE_PULSE_ALPHA = 0.95; // 线条脉冲透明度增量
const SELECTED_IDLE_BOOST = 0.95; // 关闭轨迹动画后，选中点额外亮度
const SELECTED_IDLE_PULSE_BASE = 0.96; // 关闭轨迹动画后，选中点脉冲基础值
const SELECTED_IDLE_PULSE_AMP = 0.42; // 关闭轨迹动画后，选中点脉冲振幅

const POINT_VERTEX_SHADER = `
  attribute vec3 color;
  attribute float pulse;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uSizePulseAmp;
  uniform float uFlash;
  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float pulsePhase = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
    float pulseAmount = pulse * pulsePhase;
    float sizeBoost = uSizePulseAmp * pulseAmount + uFlash * ${FLASH_SIZE_BOOST.toFixed(2)} * pulse;
    gl_PointSize = uSize * uPixelRatio * (1.0 + sizeBoost);
    gl_Position = projectionMatrix * mvPosition;
    vColor = color;
    vPulse = pulse;
  }
`;

const POINT_FRAGMENT_SHADER = `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPulseSpeed;
  uniform float uFlash;
  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float core = smoothstep(${CORE_RADIUS.toFixed(2)}, ${(
    CORE_RADIUS - 0.02
  ).toFixed(2)}, dist);
    float pulse = vPulse * (sin(uTime * uPulseSpeed) * 0.5 + 0.5);
    float flash = uFlash * vPulse;
    float haloRadius = mix(${HALO_BASE_RADIUS.toFixed(2)}, ${HALO_MAX_RADIUS.toFixed(2)}, pulse);
    haloRadius = min(${HALO_MAX_RADIUS.toFixed(2)}, haloRadius + flash * ${FLASH_RADIUS_BOOST.toFixed(2)});
    float halo = smoothstep(haloRadius, ${CORE_RADIUS.toFixed(2)}, dist);
    float haloAlpha = halo * (${HALO_BASE_ALPHA.toFixed(2)} + ${HALO_PULSE_ALPHA.toFixed(2)} * pulse + flash * ${FLASH_ALPHA_BOOST.toFixed(2)});
    float alpha = clamp(core * ${CORE_ALPHA.toFixed(2)} + haloAlpha, 0.0, 1.0);
    gl_FragColor = vec4(vColor, uOpacity * alpha);
  }
`;

const LINE_VERTEX_SHADER = `
  attribute vec3 color;
  attribute float progress;
  varying vec3 vColor;
  varying float vProgress;

  void main() {
    vColor = color;
    vProgress = progress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAGMENT_SHADER = `
  uniform float uLinePhase;
  uniform float uTrail;
  uniform float uBaseAlpha;
  uniform float uPulseAlpha;
  varying vec3 vColor;
  varying float vProgress;

  void main() {
    float dist = abs(vProgress - uLinePhase);
    float pulse = smoothstep(uTrail, 0.0, dist);
    float alpha = clamp(uBaseAlpha + pulse * uPulseAlpha, 0.0, 1.0);
    if (alpha <= 0.001) {
      discard;
    }
    vec3 color = vColor * (1.1 + pulse * 0.35);
    gl_FragColor = vec4(color, alpha);
  }
`;

const clampPositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const boostChannel = (value: number, boost: number) =>
  Math.min(1, value * (1 + boost * COLOR_BOOST_FACTOR));

const getEventPointIndex = (event: any): number => {
  if (typeof event?.index === "number") return event.index;
  if (typeof event?.intersection?.index === "number") return event.intersection.index;
  if (typeof event?.intersections?.[0]?.index === "number") return event.intersections[0].index;
  return -1;
};

const toneDown = (color: THREE.Color, amount: number) => {
  const gray = (color.r + color.g + color.b) / 3;
  return color.clone().lerp(new THREE.Color(gray, gray, gray), amount);
};

function AutoFitCamera({
  positions,
  controlsRef,
}: {
  positions: Float32Array;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!positions.length) return;
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      point.set(positions[i], positions[i + 1], positions[i + 2]);
      box.expandByPoint(point);
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = clampPositive(sphere.radius, 1);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(perspective.fov);
    const aspect = size.width / Math.max(size.height, 1);
    const fitHeight = radius / Math.sin(fov / 2);
    const fitWidth = radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
    const distance = Math.max(fitHeight, fitWidth) * 0.7;

    perspective.position.set(sphere.center.x, sphere.center.y, sphere.center.z + distance);
    perspective.near = Math.max(distance / 100, 0.1);
    perspective.far = distance * 100;
    perspective.updateProjectionMatrix();
    perspective.lookAt(sphere.center);
    if (controlsRef.current) {
      controlsRef.current.target.copy(sphere.center);
      controlsRef.current.update();
    }
  }, [positions, camera, size.width, size.height, controlsRef]);

  return null;
}

export interface EmbeddingCameraState {
  source: string;
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
  fov: number;
}

export function EmbeddingView({
  labelFieldOverride,
  hideLegend = false,
  title = "表征空间 · Three.js",
  syncId,
  syncState,
  onSyncCamera,
}: {
  labelFieldOverride?: string;
  hideLegend?: boolean;
  title?: string;
  syncId?: string;
  syncState?: EmbeddingCameraState | null;
  onSyncCamera?: (state: EmbeddingCameraState) => void;
}) {
  const {
    data,
    selectedId,
    similarIds,
    hoverPreviewId,
    hoverPreviewSimilarIds,
    highlightMode,
    selectionSource,
    labelColorMap,
    activeLabelField,
    paletteId,
    dataNonce,
    dimensionComponents,
    embeddingTrajectoryEnabled,
    sequenceSpeed,
    trajTimeline,
    trajPlayhead,
    trajActiveId,
    setSelectedId,
    setHoveredId,
    setHoverPreview,
    clearHoverPreview,
  } = useAppStore();
  const labelField = labelFieldOverride ?? activeLabelField;
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.Material> | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerNdcRef = useRef(new THREE.Vector2());
  const pointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const hoverTickRef = useRef<number | null>(null);
  const hoverClearTimerRef = useRef<number | null>(null);
  const lastHoverIdRef = useRef<string | null>(null);
  const lastHoverHitAtRef = useRef(0);
  const applyingExternalCameraRef = useRef(false);
  const hasAppliedSyncStateRef = useRef(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [legendFilter, setLegendFilter] = useState("");

  const points = useMemo(() => getCellPoints(data?.features, dimensionComponents === 2), [data, dimensionComponents]);
  const has3DData = points.length > 0;
  const activeSelectedId =
    trajActiveId
      ? trajActiveId
      : hoverPreviewId ?? selectedId;
  const activeSimilarIds = hoverPreviewId ? hoverPreviewSimilarIds : similarIds;
  const viewLabelColorMap = useMemo(() => {
    if (labelField === activeLabelField) return labelColorMap;
    return buildLabelColorMap(data, labelField, paletteId, {});
  }, [activeLabelField, data, labelColorMap, labelField, paletteId]);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    points.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [points]);

  const basePositions = useMemo(() => {
    const array = new Float32Array(points.length * 3);
    if (points.length === 0) return array;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    points.forEach((p) => {
      sx += p.position[0];
      sy += p.position[1];
      sz += p.position[2];
    });
    const cx = sx / points.length;
    const cy = sy / points.length;
    const cz = sz / points.length;
    points.forEach((p, i) => {
      array[i * 3 + 0] = (p.position[0] - cx) * EMBEDDING_SCALE;
      array[i * 3 + 1] = (p.position[1] - cy) * EMBEDDING_SCALE;
      array[i * 3 + 2] = (p.position[2] - cz) * EMBEDDING_SCALE;
    });
    return array;
  }, [points]);

  const baseColors = useMemo(() => {
    const array = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      const color = getCellColor(p, data ?? null, viewLabelColorMap, labelField, DEFAULT_CELL_COLOR);
      const [r, g, b] = hexToRgb(color);
      array[i * 3 + 0] = r * BASE_COLOR_SCALE;
      array[i * 3 + 1] = g * BASE_COLOR_SCALE;
      array[i * 3 + 2] = b * BASE_COLOR_SCALE;
    });
    return array;
  }, [points, data, viewLabelColorMap, labelField]);

  const displayColors = useMemo(() => new Float32Array(baseColors), [baseColors]);
  const colorAttributeRef = useRef<THREE.BufferAttribute | null>(null);
  const pulseValues = useMemo(() => new Float32Array(points.length), [points.length]);
  const pulseAttributeRef = useRef<THREE.BufferAttribute | null>(null);

  const pointMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: POINT_SIZE },
          uPixelRatio: { value: DEFAULT_PIXEL_RATIO },
          uTime: { value: 0 },
          uPulseSpeed: { value: PULSE_SPEED },
          uOpacity: { value: 0.68 },
          uFlash: { value: 0 },
          uSizePulseAmp: { value: SIZE_PULSE_AMP },
        },
        vertexShader: POINT_VERTEX_SHADER,
        fragmentShader: POINT_FRAGMENT_SHADER,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uLinePhase: { value: 0 },
          uTrail: { value: LINE_TRAIL },
          uBaseAlpha: { value: LINE_BASE_ALPHA },
          uPulseAlpha: { value: LINE_PULSE_ALPHA },
        },
        vertexShader: LINE_VERTEX_SHADER,
        fragmentShader: LINE_FRAGMENT_SHADER,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const legendItems = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.features ?? []).forEach((f) => {
      const name = getFeatureLabelValue(f.properties as any, labelField);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Object.entries(viewLabelColorMap)
      .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
      .map(([name, color]) => ({ name, color, count: counts.get(name) ?? 0 }));
  }, [data?.features, labelField, viewLabelColorMap]);

  const filteredLegendItems = useMemo(() => {
    const q = legendFilter.trim().toLowerCase();
    if (!q) return legendItems;
    return legendItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [legendFilter, legendItems]);

  const selectedIndex = useMemo(
    () => (activeSelectedId ? indexById.get(activeSelectedId) ?? null : null),
    [activeSelectedId, indexById]
  );

  const similarSequence = useMemo(() => {
    const sequence: number[] = [];
    activeSimilarIds.forEach((id) => {
      if (id === activeSelectedId) return;
      const idx = indexById.get(id);
      if (idx !== undefined) {
        sequence.push(idx);
      }
    });
    return sequence;
  }, [activeSimilarIds, activeSelectedId, indexById]);

  const chainIndices = useMemo(() => {
    if (selectedIndex === null) return [];
    return [selectedIndex, ...similarSequence];
  }, [selectedIndex, similarSequence]);

  const trajIndices = useMemo(() => {
    if (trajTimeline.length === 0) return [];
    const indices: number[] = [];
    trajTimeline.forEach((id) => {
      const idx = indexById.get(id);
      if (idx !== undefined) indices.push(idx);
    });
    return indices;
  }, [indexById, trajTimeline]);

  const trajLineGeometry = useMemo(() => {
    if (trajIndices.length < 2) return null;
    const positions: number[] = [];
    for (let i = 0; i < trajIndices.length - 1; i += 1) {
      const a = trajIndices[i] * 3;
      const b = trajIndices[i + 1] * 3;
      positions.push(
        basePositions[a],
        basePositions[a + 1],
        basePositions[a + 2],
        basePositions[b],
        basePositions[b + 1],
        basePositions[b + 2]
      );
    }
    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }, [basePositions, trajIndices]);

  useEffect(() => {
    if (!trajLineGeometry) return;
    const segCount = Math.max(0, trajIndices.length - 1);
    const visibleSegs = Math.max(0, Math.min(segCount, Math.floor(trajPlayhead)));
    trajLineGeometry.setDrawRange(0, visibleSegs * 2);
  }, [trajIndices.length, trajLineGeometry, trajPlayhead]);

  const lineGeometry = useMemo(() => {
    if (selectedIndex === null || similarSequence.length === 0) return null;
    const selectedOffset = selectedIndex * 3;
    const positions: number[] = [];
    const colors: number[] = [];
    const progress: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const alt = new THREE.Vector3(1, 0, 0);

    for (let link = 0; link < chainIndices.length - 1; link += 1) {
      const startIndex = chainIndices[link];
      const endIndex = chainIndices[link + 1];
      const startOffset = startIndex * 3;
      const endOffset = endIndex * 3;
      const start = new THREE.Vector3(
        basePositions[startOffset],
        basePositions[startOffset + 1],
        basePositions[startOffset + 2]
      );
      const end = new THREE.Vector3(
        basePositions[endOffset],
        basePositions[endOffset + 1],
        basePositions[endOffset + 2]
      );
      const dir = end.clone().sub(start);
      const dist = dir.length();
      if (dist < 0.001) continue;
      const axis = dir.clone().normalize();
      let normal = axis.clone().cross(up);
      if (normal.lengthSq() < 0.01) {
        normal = axis.clone().cross(alt);
      }
      normal.normalize();
      const lift = Math.min(LINE_MAX_LIFT, dist * 0.22);
      const control = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .add(normal.multiplyScalar(lift));

      const curve = new THREE.QuadraticBezierCurve3(start, control, end);
      const startColor = new THREE.Color(
        baseColors[startOffset],
        baseColors[startOffset + 1],
        baseColors[startOffset + 2]
      );
      const endColor = toneDown(
        new THREE.Color(
          boostChannel(baseColors[endOffset], 0.35),
          boostChannel(baseColors[endOffset + 1], 0.35),
          boostChannel(baseColors[endOffset + 2], 0.35)
        ),
        0.2
      );

      for (let i = 0; i < LINE_SEGMENTS; i += 1) {
        const t0 = i / LINE_SEGMENTS;
        const t1 = (i + 1) / LINE_SEGMENTS;
        const p0 = curve.getPoint(t0);
        const p1 = curve.getPoint(t1);
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        const totalSegments = Math.max(1, chainIndices.length - 1);
        const baseOffset = link / totalSegments;
        const step = 1 / totalSegments;
        progress.push(baseOffset + t0 * step, baseOffset + t1 * step);

        const mixedColor = startColor.clone().lerp(endColor, 0.5);
        colors.push(mixedColor.r, mixedColor.g, mixedColor.b, endColor.r, endColor.g, endColor.b);
      }
    }

    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("progress", new THREE.Float32BufferAttribute(progress, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }, [baseColors, basePositions, chainIndices, selectedIndex, similarSequence]);


  const sequenceStartRef = useRef<number>(0);

  useEffect(() => {
    if (similarSequence.length > 0) {
      sequenceStartRef.current = performance.now();
    }
  }, [similarSequence]);

  useEffect(() => {
    const scale = similarSequence.length >= 30 ? 0.55 : 1;
    lineMaterial.uniforms.uBaseAlpha.value = LINE_BASE_ALPHA * scale;
    lineMaterial.uniforms.uPulseAlpha.value = LINE_PULSE_ALPHA * scale;
    lineMaterial.uniforms.uTrail.value = LINE_TRAIL;
  }, [lineMaterial, similarSequence.length]);

  useEffect(() => {
    if (!displayColors.length) return;
    let frame = 0;
    const start = performance.now();
    const applyBoost = (idx: number, boost: number) => {
      const offset = idx * 3;
      const r = baseColors[offset];
      const g = baseColors[offset + 1];
      const b = baseColors[offset + 2];
      const amt = Math.min(1, Math.max(0, boost));
      displayColors[offset] = boostChannel(r, amt);
      displayColors[offset + 1] = boostChannel(g, amt);
      displayColors[offset + 2] = boostChannel(b, amt);
    };
    const tick = () => {
      const now = performance.now();
      const time = (now - start) / 1000;
      const sequenceTime = (now - sequenceStartRef.current) / 1000;
      const head = embeddingTrajectoryEnabled ? (sequenceTime * sequenceSpeed) % 1 : 0;
      const totalSegments = Math.max(1, chainIndices.length - 1);
      const headPos = head * totalSegments;
      const segment = totalSegments > 0 ? Math.min(totalSegments - 1, Math.floor(headPos)) : 0;
      const mix = totalSegments > 0 ? headPos - segment : 0;
      displayColors.set(baseColors);
      pulseValues.fill(0);
      if (embeddingTrajectoryEnabled && chainIndices.length > 1) {
        const a = chainIndices[segment];
        const b = chainIndices[segment + 1];
        const pulse = Math.sin(head * Math.PI);
        const boostA = (1 - mix) * (SIMILAR_BOOST + pulse * SIMILAR_PULSE_BOOST);
        const boostB = mix * (SIMILAR_BOOST + pulse * SIMILAR_PULSE_BOOST);
        applyBoost(a, boostA);
        applyBoost(b, boostB);
        pulseValues[a] = Math.max(pulseValues[a], SIMILAR_PULSE_BASE + pulse * 0.7 * (1 - mix));
        pulseValues[b] = Math.max(pulseValues[b], SIMILAR_PULSE_BASE + pulse * 0.7 * mix);
      } else {
        similarSequence.forEach((idx) => {
          applyBoost(idx, SIMILAR_BOOST);
          pulseValues[idx] = Math.max(pulseValues[idx], 0);
        });
      }
      if (selectedIndex !== null) {
        const selectedBoost = embeddingTrajectoryEnabled ? SELECTED_BOOST : SELECTED_BOOST + SELECTED_IDLE_BOOST;
        applyBoost(selectedIndex, selectedBoost);
      }
      if (colorAttributeRef.current) {
        colorAttributeRef.current.needsUpdate = true;
      }
      if (pulseAttributeRef.current) {
        if (selectedIndex !== null) {
          const selectedPulse = embeddingTrajectoryEnabled
            ? 0.7
            : SELECTED_IDLE_PULSE_BASE + (Math.sin(time * 5) * 0.5 + 0.5) * SELECTED_IDLE_PULSE_AMP;
          pulseValues[selectedIndex] = Math.max(pulseValues[selectedIndex], selectedPulse);
        }
        pulseAttributeRef.current.needsUpdate = true;
      }
      pointMaterial.uniforms.uTime.value = time;
      pointMaterial.uniforms.uFlash.value = 0;
      lineMaterial.uniforms.uLinePhase.value = head;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    baseColors,
    displayColors,
    similarSequence,
    chainIndices,
    selectedIndex,
    pointMaterial,
    lineMaterial,
    pulseValues,
    embeddingTrajectoryEnabled,
    sequenceSpeed,
  ]);

  const handlePointClick = useCallback(
    (event: any) => {
      const index = getEventPointIndex(event);
      if (index < 0 || index >= points.length) return;
      const id = points[index].id;
      if (id && highlightMode === "click") {
        void setSelectedId(id, "embedding-click");
      }
      event.stopPropagation?.();
    },
    [highlightMode, points, setSelectedId]
  );

  const clearEmbeddingHoverPreview = useCallback(() => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
    lastHoverIdRef.current = null;
    lastHoverHitAtRef.current = 0;
    setHoveredId(null);
    if (highlightMode === "hover" && selectionSource === "embedding-hover") {
      clearHoverPreview();
    }
  }, [clearHoverPreview, highlightMode, selectionSource, setHoveredId]);

  const scheduleEmbeddingHoverClear = useCallback(
    (delayMs = HOVER_CLEAR_DELAY_MS) => {
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
      }
      hoverClearTimerRef.current = window.setTimeout(() => {
        hoverClearTimerRef.current = null;
        const elapsed = performance.now() - lastHoverHitAtRef.current;
        if (elapsed < HOVER_HOLD_MS) {
          hoverClearTimerRef.current = window.setTimeout(() => {
            hoverClearTimerRef.current = null;
            clearEmbeddingHoverPreview();
          }, HOVER_HOLD_MS - elapsed);
          return;
        }
        clearEmbeddingHoverPreview();
      }, delayMs);
    },
    [clearEmbeddingHoverPreview]
  );

  const applyHoverPreview = useCallback(
    (id: string | null) => {
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      if (id) {
        lastHoverHitAtRef.current = performance.now();
      }
      if (id === lastHoverIdRef.current && (id === null || selectionSource === "embedding-hover")) {
        return;
      }
      lastHoverIdRef.current = id;
      setHoveredId(id);
      if (highlightMode !== "hover") return;
      if (!id) {
        if (selectionSource === "embedding-hover") {
          clearHoverPreview();
        }
        return;
      }
      if (id !== hoverPreviewId || selectionSource !== "embedding-hover") {
        setHoverPreview(id, "embedding-hover");
      }
    },
    [clearHoverPreview, highlightMode, hoverPreviewId, selectionSource, setHoverPreview, setHoveredId]
  );

  const handlePointMove = useCallback(
    (event: any) => {
      if (highlightMode !== "hover") return;
      const index = getEventPointIndex(event);
      if (index < 0 || index >= points.length) {
        scheduleEmbeddingHoverClear();
        return;
      }
      const id = points[index].id;
      applyHoverPreview(id ?? null);
    },
    [applyHoverPreview, highlightMode, points, scheduleEmbeddingHoverClear]
  );

  const handlePointOver = useCallback(
    (event: any) => {
      if (highlightMode !== "hover") return;
      handlePointMove(event);
    },
    [handlePointMove, highlightMode]
  );

  useEffect(() => {
    if (highlightMode !== "hover") {
      clearEmbeddingHoverPreview();
      return;
    }
    const container = canvasWrapRef.current;
    if (!container || points.length === 0) return;

    const runPick = () => {
      hoverTickRef.current = null;
      const pending = pointerClientRef.current;
      const camera = cameraRef.current;
      const pointsObject = pointsRef.current;
      if (!pending || !camera || !pointsObject) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdcRef.current.x = ((pending.x - rect.left) / rect.width) * 2 - 1;
      pointerNdcRef.current.y = -((pending.y - rect.top) / rect.height) * 2 + 1;

      const raycaster = raycasterRef.current;
      raycaster.params.Points = { threshold: HOVER_PICK_THRESHOLD };
      raycaster.setFromCamera(pointerNdcRef.current, camera);
      const intersections = raycaster.intersectObject(pointsObject, false);
      const hitIndex = typeof intersections[0]?.index === "number" ? intersections[0].index : -1;
      if (hitIndex >= 0 && hitIndex < points.length) {
        applyHoverPreview(points[hitIndex].id);
        return;
      }
      scheduleEmbeddingHoverClear();
    };

    const handleFallbackMove = (event: PointerEvent) => {
      pointerClientRef.current = { x: event.clientX, y: event.clientY };
      if (hoverTickRef.current === null) {
        hoverTickRef.current = requestAnimationFrame(runPick);
      }
    };

    const handleFallbackLeave = () => {
      pointerClientRef.current = null;
      if (hoverTickRef.current !== null) {
        cancelAnimationFrame(hoverTickRef.current);
        hoverTickRef.current = null;
      }
      clearEmbeddingHoverPreview();
    };

    container.addEventListener("pointermove", handleFallbackMove, { passive: true });
    container.addEventListener("pointerleave", handleFallbackLeave);

    return () => {
      container.removeEventListener("pointermove", handleFallbackMove);
      container.removeEventListener("pointerleave", handleFallbackLeave);
      if (hoverTickRef.current !== null) {
        cancelAnimationFrame(hoverTickRef.current);
        hoverTickRef.current = null;
      }
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      pointerClientRef.current = null;
    };
  }, [applyHoverPreview, clearEmbeddingHoverPreview, highlightMode, points, scheduleEmbeddingHoverClear]);

  const emitCameraState = useCallback(() => {
    if (!onSyncCamera || !syncId || !controlsRef.current || !cameraRef.current) return;
    const camera = cameraRef.current;
    const target = controlsRef.current.target;
    onSyncCamera({
      source: syncId,
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      zoom: camera.zoom,
      fov: camera.fov,
    });
  }, [onSyncCamera, syncId]);

  useEffect(() => {
    if (!syncState || !syncId) return;
    if (syncState.source === syncId && hasAppliedSyncStateRef.current) return;
    if (!cameraRef.current || !controlsRef.current) return;

    hasAppliedSyncStateRef.current = true;
    applyingExternalCameraRef.current = true;
    cameraRef.current.position.set(syncState.position[0], syncState.position[1], syncState.position[2]);
    cameraRef.current.zoom = syncState.zoom;
    cameraRef.current.fov = syncState.fov;
    cameraRef.current.updateProjectionMatrix();
    controlsRef.current.target.set(syncState.target[0], syncState.target[1], syncState.target[2]);
    controlsRef.current.update();
    requestAnimationFrame(() => {
      applyingExternalCameraRef.current = false;
    });
  }, [syncId, syncState]);

  useEffect(() => {
    if (!syncId || !onSyncCamera || !cameraRef.current || !controlsRef.current) return;
    emitCameraState();
  }, [dataNonce, emitCameraState, onSyncCamera, syncId]);

  return (
    <div className="view-card">
      <div className="view-header">
        <div>{title}</div>
        {!hideLegend && (
          <button
            type="button"
            className="legend-toggle"
            onClick={() => setLegendOpen((prev) => !prev)}
          >
            {legendOpen ? "隐藏图例" : "显示图例"}
          </button>
        )}
      </div>
      <div className="three-container" ref={canvasWrapRef}>
        {!has3DData && <div className="empty-state">未分析或无可用 reduction_embedding，请先上传并完成分析。</div>}
        {!hideLegend && legendOpen && (
          <div className="legend-card">
            <div className="legend-title">图例 · {labelField}</div>
            <div className="legend-meta">
              <input
                className="legend-search"
                value={legendFilter}
                onChange={(e) => setLegendFilter(e.target.value)}
                placeholder="筛选..."
              />
              <span className="legend-count">
                {filteredLegendItems.length}/{legendItems.length}
              </span>
            </div>
            <div className="legend-list">
              {legendItems.length === 0 && <div className="legend-empty">暂无类别</div>}
              {legendItems.length > 0 && filteredLegendItems.length === 0 && <div className="legend-empty">无匹配</div>}
              {filteredLegendItems.map((item) => (
                <div className="legend-item" key={item.name} title={`${item.name} (${item.count})`}>
                  <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-number">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Canvas
          key={dataNonce}
          camera={{ position: [0, 0, 70], fov: 45 }}
          dpr={[1, 2]}
          onCreated={({ camera }) => {
            cameraRef.current = camera as THREE.PerspectiveCamera;
            requestAnimationFrame(() => {
              emitCameraState();
            });
          }}
          raycaster={{
            params: {
              Mesh: {},
              Line: { threshold: 1 },
              LOD: {},
              Points: { threshold: HOVER_PICK_THRESHOLD },
              Sprite: {},
            },
          }}
        >
          <color attach="background" args={["#0a101a"]} />
          <fog attach="fog" args={["#0a101a", 60, 140]} />
          <AutoFitCamera positions={basePositions} controlsRef={controlsRef} />
          <ambientLight intensity={0.6} />
          <pointLight position={[12, 10, 16]} intensity={1.4} />
          {trajLineGeometry && trajTimeline.length > 1 && (
            <lineSegments frustumCulled={false}>
              <primitive object={trajLineGeometry} attach="geometry" />
              <lineBasicMaterial attach="material" color="#55e6ff" transparent opacity={0.28} />
            </lineSegments>
          )}
          {lineGeometry && embeddingTrajectoryEnabled && (
            <>
              <lineSegments frustumCulled={false}>
                <primitive object={lineGeometry} attach="geometry" />
                <primitive object={lineMaterial} attach="material" />
              </lineSegments>
            </>
          )}

          <points
            ref={pointsRef}
            frustumCulled={false}
            onPointerDown={handlePointClick}
            onPointerOver={handlePointOver}
            onPointerMove={handlePointMove}
            onPointerOut={() => {
              if (highlightMode !== "hover") return;
              scheduleEmbeddingHoverClear();
            }}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={basePositions}
                count={basePositions.length / 3}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-color"
                ref={colorAttributeRef}
                array={displayColors}
                count={displayColors.length / 3}
                itemSize={3}
              />
              <bufferAttribute
                attach="attributes-pulse"
                ref={pulseAttributeRef}
                array={pulseValues}
                count={pulseValues.length}
                itemSize={1}
              />
            </bufferGeometry>
            <primitive object={pointMaterial} attach="material" />
          </points>

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.15}
            onChange={() => {
              if (applyingExternalCameraRef.current) return;
              emitCameraState();
            }}
          />
        </Canvas>
      </div>
    </div>
  );
}
