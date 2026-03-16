from __future__ import annotations

import copy
import uuid
from typing import Any, Dict, Optional, Tuple

_POI_DATASETS: Dict[str, Dict[str, Any]] = {}
_TRAJ_DATASETS_RAW: Dict[str, Dict[str, Any]] = {}
_TRAJ_DATASETS_ANALYZED: Dict[str, Dict[str, Any]] = {}


def _require_feature_collection(payload: Dict[str, Any]) -> list[Dict[str, Any]]:
    if payload.get("type") != "FeatureCollection":
        raise ValueError("Only FeatureCollection is supported")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) == 0:
        raise ValueError("FeatureCollection must include non-empty features")
    for idx, feature in enumerate(features):
        if not isinstance(feature, dict):
            raise ValueError(f"feature[{idx}] must be an object")
    return features  # type: ignore[return-value]


def _normalize_point_feature(
    feature: Dict[str, Any],
    idx: int,
    *,
    force_kind: str,
    role: str,
    id_prefix: str,
) -> Dict[str, Any]:
    geometry = feature.get("geometry") or {}
    if not isinstance(geometry, dict):
        raise ValueError(f"feature[{idx}].geometry must be an object")
    if geometry.get("type") != "Point":
        raise ValueError(f"feature[{idx}].geometry.type must be Point")
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        raise ValueError(f"feature[{idx}].geometry.coordinates must be [lng, lat]")
    lng = float(coords[0])
    lat = float(coords[1])
    if not (lng == lng and lat == lat):  # NaN guard
        raise ValueError(f"feature[{idx}] invalid lng/lat")

    props = feature.get("properties") or {}
    if not isinstance(props, dict):
        raise ValueError(f"feature[{idx}].properties must be an object")
    fid = props.get("id")
    if not isinstance(fid, str) or not fid.strip():
        fid = f"{id_prefix}_{idx}"

    # Keep kind compatible with current frontend ("cell" | "poi") and tag role explicitly.
    normalized_props = {
        **props,
        "id": str(fid),
        "kind": force_kind,
        "feature_role": role,
    }

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": normalized_props,
    }


def ingest_poi_feature_collection(payload: Dict[str, Any]) -> Tuple[str, int]:
    features = _require_feature_collection(payload)
    normalized = []
    for idx, feature in enumerate(features):
        normalized.append(
            _normalize_point_feature(
                feature,
                idx,
                force_kind="poi",
                role="poi",
                id_prefix="poi",
            )
        )
    dataset_id = f"poi_{uuid.uuid4().hex[:12]}"
    _POI_DATASETS[dataset_id] = {"type": "FeatureCollection", "features": normalized}
    return dataset_id, len(normalized)


def ingest_traj_feature_collection(payload: Dict[str, Any]) -> Tuple[str, int]:
    features = _require_feature_collection(payload)
    normalized = []
    for idx, feature in enumerate(features):
        normalized.append(
            _normalize_point_feature(
                feature,
                idx,
                force_kind="poi",
                role="traj_point",
                id_prefix="tp",
            )
        )
    dataset_id = f"traj_{uuid.uuid4().hex[:12]}"
    _TRAJ_DATASETS_RAW[dataset_id] = {"type": "FeatureCollection", "features": normalized}
    _TRAJ_DATASETS_ANALYZED.pop(dataset_id, None)
    return dataset_id, len(normalized)


def get_poi_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
    return _POI_DATASETS.get(dataset_id)


def get_traj_dataset(dataset_id: str, analyzed: bool = True) -> Optional[Dict[str, Any]]:
    if analyzed and dataset_id in _TRAJ_DATASETS_ANALYZED:
        return _TRAJ_DATASETS_ANALYZED[dataset_id]
    return _TRAJ_DATASETS_RAW.get(dataset_id)


def set_traj_analyzed_dataset(dataset_id: str, collection: Dict[str, Any]) -> None:
    _TRAJ_DATASETS_ANALYZED[dataset_id] = copy.deepcopy(collection)

