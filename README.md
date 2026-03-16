# 轨迹表征可视化（Kepler 风格双视图）

一个最小可运行的全栈示例：百度地图 WebGL 地理空间 + Three.js 表征空间联动，用于轨迹表征交互式分析与可视化。前端只负责渲染与交互；数据接入与分析计算在 Python 后端完成。

提醒：仓库根目录的 `shenzhen_cleaned.geojson` 是早期格网 demo 数据，当前版本已移除格网功能线，不再使用该文件。

## 仓库结构

- `frontend/` Vite + React + TypeScript
- `backend/` FastAPI + uv（依赖管理）

## 后端（FastAPI + uv）

在仓库根目录执行：

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

说明：
- `pyproject.toml` 已提供，直接 `uv sync` 安装依赖。
- 如需新增依赖再用：`uv add <package>`。
- 启动/运行：`uv run ...`。

## 前端（Vite + React）

在仓库根目录执行：

```bash
cd frontend
npm install
npm run dev
```

前端默认访问 `http://localhost:8000` 的后端。

可选环境变量（百度个性化地图）：
- `VITE_BAIDU_STYLE_ID`：默认深色 styleId（推荐）
- `VITE_BAIDU_STYLE_ID_DARK` / `VITE_BAIDU_STYLE_ID_LIGHT` 等：按主题覆盖 styleId

## API 接口

- `GET /health`
- `GET /proxy/baidu-tile?x=...&y=...&z=...&customid=...&ak=...`（可选：代理百度个性化底图瓦片）
- `POST /traj/poi/upload`（上传 POI GeoJSON）
- `POST /traj/track/upload`（上传轨迹点 GeoJSON）
- `POST /api/traj-analysis/start`（启动轨迹表征分析任务）
- `GET /api/traj-analysis/progress?task_id=...`
- `GET /api/traj-analysis/result?task_id=...`

## 验收要点

- 默认双视图显示：左侧轨迹模块 + 特征空间 + 地图。
- 上传 POI + 轨迹点 GeoJSON 后，点击“开始轨迹分析”能得到降维/聚类/相似结果并渲染到特征空间。
- 播放进度条会联动：地图上的轨迹移动 + 特征空间的轨迹连线推进。
