from __future__ import annotations

import logging
import os
import threading
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from .analysis import AnalysisCache, GridAnalysisRequest, run_grid_analysis
from .traj.analysis import run_traj_vectorize
from .traj.data import (
    get_poi_dataset,
    get_traj_dataset,
    ingest_poi_feature_collection,
    ingest_traj_feature_collection,
    set_traj_analyzed_dataset,
)
from .traj.schemas import PoiUploadResponse, TrajAnalysisRequest, TrajUploadResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Trajectory Representation Visual Analytics API")
analysis_cache = AnalysisCache()
traj_tasks: Dict[str, Dict[str, Any]] = {}
traj_tasks_lock = threading.Lock()


def _resolve_baidu_ak(query_ak: str | None) -> str | None:
    if query_ak and query_ak.strip():
        return query_ak.strip()
    env_ak = os.getenv("BAIDU_AK") or os.getenv("VITE_BAIDU_AK")
    if env_ak and env_ak.strip():
        return env_ak.strip()
    return None

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.get("/proxy/baidu-tile")
def proxy_baidu_tile(
    x: int = Query(...),
    y: int = Query(...),
    z: int = Query(...),
    scale: int = Query(1, ge=1, le=2),
    customid: str = Query("normal"),
    ak: str | None = Query(None),
) -> Response:
    resolved_ak = _resolve_baidu_ak(ak)
    if not resolved_ak:
        raise HTTPException(status_code=400, detail="Baidu AK is missing")

    target = (
        "https://api.map.baidu.com/customimage/tile"
        f"?x={x}&y={y}&z={z}&scale={scale}&customid={customid}&ak={resolved_ak}"
    )
    req = urllib.request.Request(
        target,
        headers={
            "User-Agent": "TrajectoryReprViz/1.0",
            "Referer": "http://localhost",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:  # noqa: S310
            content = resp.read()
            media_type = resp.headers.get_content_type() or "image/png"
            return Response(content=content, media_type=media_type)
    except urllib.error.HTTPError as exc:
        detail = f"baidu tile http error: {exc.code}"
    except urllib.error.URLError as exc:
        detail = f"baidu tile network error: {exc.reason}"
    except Exception as exc:  # noqa: BLE001
        detail = f"baidu tile proxy failed: {exc}"
    raise HTTPException(status_code=502, detail=detail)


@app.post("/traj/poi/upload", response_model=PoiUploadResponse)
async def upload_poi(request: Request) -> Dict[str, Any]:
    payload = await request.json()
    try:
        dataset_id, count = ingest_poi_feature_collection(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"poi_dataset_id": dataset_id, "poi_count": count}


@app.post("/traj/track/upload", response_model=TrajUploadResponse)
async def upload_traj(request: Request) -> Dict[str, Any]:
    payload = await request.json()
    try:
        dataset_id, count = ingest_traj_feature_collection(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"traj_dataset_id": dataset_id, "point_count": count}


def _set_traj_task_state(task_id: str, **fields: Any) -> None:
    with traj_tasks_lock:
        if task_id not in traj_tasks:
            return
        traj_tasks[task_id].update(fields)


def _run_traj_task(task_id: str, payload: TrajAnalysisRequest) -> None:
    logger.info(
        "traj-analysis started task_id=%s traj_dataset_id=%s poi_dataset_id=%s",
        task_id,
        payload.traj_dataset_id,
        payload.poi_dataset_id,
    )
    traj_raw = get_traj_dataset(payload.traj_dataset_id, analyzed=False)
    poi_raw = get_poi_dataset(payload.poi_dataset_id)
    if traj_raw is None:
        _set_traj_task_state(
            task_id,
            status="failed",
            progress=100,
            stage="error",
            message="traj_dataset_id not found",
            error="traj_dataset_id not found",
        )
        return
    if poi_raw is None:
        _set_traj_task_state(
            task_id,
            status="failed",
            progress=100,
            stage="error",
            message="poi_dataset_id not found",
            error="poi_dataset_id not found",
        )
        return

    def progress_cb(progress: int, stage: str, message: str) -> None:
        _set_traj_task_state(task_id, progress=progress, stage=stage, message=message, status="running")

    try:
        progress_cb(10, "vectorize", "Querying POIs and building embeddings")
        vectorized = run_traj_vectorize(
            traj_raw,
            poi_raw,
            radius_m=payload.radius_m,
            vector_dim=payload.vector_dim,
            poi_category_field=payload.poi_category_field,
            coord_system=payload.coord_system,
        )
        progress_cb(25, "analysis", "Running dimension/clustering/similarity")
        # Reuse existing analysis pipeline with a synthetic dataset_id for caching.
        grid_payload = GridAnalysisRequest(
            dataset_id=f"{payload.traj_dataset_id}__r{int(payload.radius_m)}__d{payload.vector_dim}",
            dimension=payload.dimension,
            clustering=payload.clustering,
            similarity=payload.similarity,
            sampling=payload.sampling,
        )
        result = run_grid_analysis(vectorized, grid_payload, analysis_cache, progress=progress_cb)
        set_traj_analyzed_dataset(payload.traj_dataset_id, result)
        _set_traj_task_state(
            task_id,
            status="completed",
            progress=100,
            stage="done",
            message="Analysis completed",
            result=result,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("traj-analysis failed task_id=%s", task_id)
        _set_traj_task_state(
            task_id,
            status="failed",
            progress=100,
            stage="error",
            message=str(exc),
            error=str(exc),
        )


@app.post("/api/traj-analysis/start")
def traj_analysis_start(payload: TrajAnalysisRequest) -> Dict[str, Any]:
    task_id = f"traj_{uuid.uuid4().hex[:12]}"
    with traj_tasks_lock:
        traj_tasks[task_id] = {
            "task_id": task_id,
            "traj_dataset_id": payload.traj_dataset_id,
            "poi_dataset_id": payload.poi_dataset_id,
            "status": "queued",
            "progress": 0,
            "stage": "queued",
            "message": "Queued",
            "result": None,
            "error": None,
        }
    thread = threading.Thread(target=_run_traj_task, args=(task_id, payload), daemon=True)
    thread.start()
    return {"task_id": task_id}


@app.get("/api/traj-analysis/progress")
def traj_analysis_progress(task_id: str = Query(..., min_length=1)) -> Dict[str, Any]:
    with traj_tasks_lock:
        task = traj_tasks.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task_id not found")
        return {
            "task_id": task["task_id"],
            "traj_dataset_id": task["traj_dataset_id"],
            "poi_dataset_id": task["poi_dataset_id"],
            "status": task["status"],
            "progress": task["progress"],
            "stage": task["stage"],
            "message": task["message"],
            "error": task["error"],
        }


@app.get("/api/traj-analysis/result")
def traj_analysis_result(task_id: str = Query(..., min_length=1)) -> Dict[str, Any]:
    with traj_tasks_lock:
        task = traj_tasks.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task_id not found")
        status = task["status"]
        if status == "failed":
            raise HTTPException(status_code=500, detail=task.get("error") or "analysis failed")
        if status != "completed":
            raise HTTPException(status_code=202, detail="analysis not completed")
        result = task.get("result")
        if result is None:
            raise HTTPException(status_code=500, detail="analysis result missing")
        return result
