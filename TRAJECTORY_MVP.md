# Trajectory Representation MVP (Based on This Repo)

This repo now includes a new trajectory analysis workflow:

POI radius query -> per-trajectory-point embedding (hashed category counts) -> dimension reduction/clustering/similarity -> dual-view playback (Baidu map + embedding space).

## Run

Backend:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Frontend Entry

Left dock tab: `轨迹分析`

1. Upload POI GeoJSON
2. Upload Trajectory Point GeoJSON
3. Set `radius_m`, `vector_dim`, `poi_category_field`
4. Start analysis
5. Use playback slider to drive map + embedding connection

## API

- `POST /traj/poi/upload` -> `{ poi_dataset_id, poi_count }`
- `POST /traj/track/upload` -> `{ traj_dataset_id, point_count }`
- `POST /api/traj-analysis/start` -> `{ task_id }`
- `GET /api/traj-analysis/progress?task_id=...`
- `GET /api/traj-analysis/result?task_id=...` -> analyzed GeoJSON

## Input Formats

### POI GeoJSON (Point features)

Minimum required:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [114.06, 22.54] },
      "properties": { "id": "poi_1", "category": "餐饮" }
    }
  ]
}
```

Notes:
- Category field defaults to `category`, configurable via `poi_category_field`.
- Coordinates must be consistent with trajectory coordinates (default assumed: GCJ02 degrees).

### Trajectory GeoJSON (Point features)

Minimum required:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [114.06, 22.54] },
      "properties": { "id": "tp_1", "traj_id": "t0", "ts": 1710000000, "seq": 0 }
    }
  ]
}
```

Notes:
- `ts` is optional but recommended. If absent, ordering falls back to `seq`, then file order.

## Output Fields

Each trajectory point feature will have:
- `properties.embedding`: hashed vector (float list)
- `properties.reduction_embedding`: 2D/3D reduced coords (after analysis)
- `properties.cluster_id/cluster_label`, `properties.neighbors` (if enabled)
- `properties.poi_in_radius`, `properties.radius_m`

## 改造方案（借鉴“格网可视化 Demo”的交互与呈现）

你给的格网 Demo（左侧算法模块 + 中间表征空间 + 右侧地图）本质上是「同一份分析结果在 *特征空间* 与 *地理空间* 的双视图联动」。
当前轨迹 MVP 已经复用了同一套分析管线（`properties.embedding -> reduction/clustering/similarity`），下一步建议把“轨迹”补齐为一等公民，并补上“网格汇总层”，让整体体验更接近格网 Demo。

### 目标 1：把对象从“轨迹点”升级为“轨迹（traj_id）”

现状：分析与可视化主要围绕单点（traj_point）进行，播放只是沿时间推进点位。

建议：
1. **轨迹级表征**：按 `traj_id` 聚合点的 embedding（mean / attention / TF-IDF-like），得到“每条轨迹一个向量”，再走同样的降维/聚类/相似度；表征空间默认展示“轨迹点”或“轨迹”，可切换。
2. **双层联动**：
   - 轨迹级：点击一条轨迹 -> 地图高亮整条线；相似轨迹以不同透明度/描边显示。
   - 点级：选中轨迹后，播放/刷选只在该轨迹范围内推进。
3. **轨迹列表与过滤**：左侧增加轨迹列表（按 cluster、poi_top_category、长度、时间跨度等排序/过滤），支持多选对比。

落点文件（建议）：
- Backend：`backend/app/traj/analysis.py`（新增按 `traj_id` 聚合函数），`backend/app/main.py`（新增/扩展接口返回轨迹级结果）
- Frontend：`frontend/src/store/useAppStore.ts`（新增 `entityMode: "point" | "traj"`、轨迹列表状态），`frontend/src/components/BaiduMapView.tsx`（多轨迹渲染与高亮）

### 目标 2：补上“网格汇总层”（让地图像格网 Demo 一样有“面状语义”）

格网 Demo 的优势是：地图上不仅有点/线，还有可感知的空间单元（hex/h3）与颜色图例。

建议新增两类网格层（可作为可选 overlay）：
1. **轨迹密度网格**：把轨迹点落到网格单元（推荐 H3 hex），统计 `count / unique_traj / dwell_time` 等指标，地图渲染为 polygon（填充按指标映射）。
2. **POI 语义网格**：对每个网格统计 `poi_top_category` 或类别分布，支持按类别着色（与表征空间图例一致）。

落点文件（建议）：
- Backend：新增一个“聚合到网格”的接口（例如 `/api/traj-aggregate/grid`），输出 polygon GeoJSON（每个 feature 带 `metric/info/label`）
- Frontend：`frontend/src/components/BaiduMapView.tsx`（polygon overlay + legend），`frontend/src/store/useAppStore.ts`（gridLayer 开关与配色字段）

### 目标 3：交互对齐格网 Demo（提升“可解释性”和“探索效率”）

1. **统一图例/标签字段**：表征空间与地图始终使用同一 `activeLabelField` 与 `labelColorMap`（当前已有基础，可补“锁定颜色/导出配色”）。
2. **选择模式一致**：click/hover 高亮在两视图一致，并提供“锁定选择/清空选择”的快捷入口。
3. **探索闭环**：左侧增加“当前对象信息卡”（轨迹/点的 poi_top_categories、neighbors、cluster 等），支持一键跳转到地图中心或表征空间聚焦。

落点文件（建议）：
- `frontend/src/components/EmbeddingView.tsx`
- `frontend/src/components/BaiduMapView.tsx`
- `frontend/src/components/TrajectoryAnalysisPanel.tsx`

### 目标 4：性能与工程化（真实数据规模可用）

1. **渐进采样**：对点云与 POI 渲染做分层（当前已有 sampling 参数；建议在 UI 明确提示“抽样/截断”并提供“导出全量结果”的路径）。
2. **任务与缓存**：分析任务支持 task 取消/重复提交去重；结果落盘（带 TTL）避免内存常驻。
3. **坐标系处理**：`coord_system` 目前仅记录，建议在后端做必要的转换或在 UI 明确提示“必须一致”并提供校验。

---

如果你希望我“直接动代码”，建议先从 **目标 1（轨迹级表征 + 多轨迹联动）** 开始：改动面最小、收益最大；目标 2 的 H3 网格层可作为第二阶段增强。
