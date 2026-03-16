import type { FeatureCollection, GeoFeature } from "../types";

export const DEFAULT_CELL_COLOR = "#2c3e5a";
export const DEFAULT_LABEL_FALLBACK = "未标注";

export const PALETTES = {
  givaClassic: [
    "#ff7eb6",
    "#49b6ff",
    "#ffd44f",
    "#56d972",
    "#9a7cff",
    "#ff9b57",
    "#00c7c7",
    "#ff6b8a",
    "#6db6ff",
    "#b8d93e",
    "#f878ff",
    "#3fd08d",
    "#ffb347",
    "#6e92ff",
    "#54d8ff",
    "#ffc4df",
    "#7be1b0",
    "#c6d6ff",
    "#ffe27c",
    "#ff8ec7",
    "#7bc5ff",
    "#8fdf54",
    "#c79bff",
    "#ffb07a",
  ],
  tableau20: [
    "#4e79a7",
    "#f28e2b",
    "#e15759",
    "#76b7b2",
    "#59a14f",
    "#edc948",
    "#b07aa1",
    "#ff9da7",
    "#9c755f",
    "#bab0ab",
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ],
  tolVibrant: ["#ee7733", "#0077bb", "#33bbee", "#009988", "#cc3311", "#ee3377", "#bbbbbb", "#66ccee"],
} as const;

export type PaletteId = keyof typeof PALETTES;

const fallbackPalette: readonly string[] = PALETTES.givaClassic;

export interface PaletteOption {
  id: PaletteId;
  label: string;
  description: string;
  swatches: string[];
}

export const paletteOptions: PaletteOption[] = [
  {
    id: "givaClassic",
    label: "基础",
    description: "默认",
    swatches: PALETTES.givaClassic.slice(0, 8),
  },
  {
    id: "tableau20",
    label: "均衡",
    description: "通用",
    swatches: PALETTES.tableau20.slice(0, 8),
  },
  {
    id: "tolVibrant",
    label: "对比",
    description: "分组",
    swatches: [...PALETTES.tolVibrant],
  },
];

const hslToHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = light - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
};

const buildExtendedPalette = (paletteId: PaletteId, targetLength: number): string[] => {
  const base = [...(PALETTES[paletteId] ?? fallbackPalette)] as string[];
  if (targetLength <= base.length) return base;
  const goldenAngle = 137.508;
  let i = 0;
  while (base.length < targetLength) {
    const h = (i * goldenAngle + 27) % 360;
    const s = 62 + (i % 3) * 9;
    const l = 48 + ((i + 1) % 4) * 6;
    base.push(hslToHex(h, Math.min(88, s), Math.min(72, l)));
    i += 1;
  }
  return base;
};

export const getFeatureLabelValue = (
  featureLike: { [key: string]: unknown } | null | undefined,
  labelField: string
): string => {
  if (!featureLike) return DEFAULT_LABEL_FALLBACK;
  const direct = featureLike[labelField];
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
  if (labelField !== "info") {
    const info = featureLike.info;
    if (info !== undefined && info !== null && String(info).trim() !== "") return String(info);
  }
  const className = featureLike.class;
  if (className !== undefined && className !== null && String(className).trim() !== "") return String(className);
  return DEFAULT_LABEL_FALLBACK;
};

export const buildLabelColorMap = (
  collection: FeatureCollection | null,
  labelField: string,
  paletteId: PaletteId = "givaClassic",
  existing: Record<string, string> = {}
): Record<string, string> => {
  if (!collection) return { ...existing };
  const next: Record<string, string> = {};
  const values = new Set<string>();
  collection.features.forEach((feature) => {
    values.add(String(getFeatureLabelValue(feature.properties, labelField)));
  });
  const ordered = Array.from(values).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const palette = buildExtendedPalette(paletteId, ordered.length);
  ordered.forEach((value, index) => {
    next[value] = palette[index] ?? DEFAULT_CELL_COLOR;
  });
  return next;
};

export const buildLabelColorExpression = (colorMap: Record<string, string>, labelField: string) => {
  const entries = Object.entries(colorMap);
  if (entries.length === 0) return DEFAULT_CELL_COLOR;
  const expression: (string | any)[] = [
    "match",
    ["coalesce", ["to-string", ["get", labelField]], ["get", "info"], ["get", "class"], DEFAULT_LABEL_FALLBACK],
  ];
  entries.forEach(([value, color]) => expression.push(value, color));
  expression.push(DEFAULT_CELL_COLOR);
  return expression;
};

export const getCellColor = (
  cellOrId: GeoFeature | { id?: string; [key: string]: unknown } | string | null | undefined,
  data: FeatureCollection | null,
  colorMap: Record<string, string>,
  labelField: string,
  fallback: string = DEFAULT_CELL_COLOR
): string => {
  if (!cellOrId) return fallback;
  if (typeof cellOrId === "string") {
    const feature = data?.features.find((item) => item.properties.id === cellOrId);
    if (!feature) return fallback;
    const value = getFeatureLabelValue(feature.properties, labelField);
    return colorMap[value] ?? fallback;
  }
  if ("properties" in cellOrId) {
    const value = getFeatureLabelValue(cellOrId.properties as Record<string, unknown>, labelField);
    return colorMap[value] ?? fallback;
  }
  const value = getFeatureLabelValue(cellOrId, labelField);
  if (colorMap[value]) return colorMap[value];
  if (cellOrId.id && data) {
    const feature = data.features.find((item) => item.properties.id === cellOrId.id);
    if (feature) {
      const resolved = getFeatureLabelValue(feature.properties, labelField);
      return colorMap[resolved] ?? fallback;
    }
  }
  return fallback;
};
