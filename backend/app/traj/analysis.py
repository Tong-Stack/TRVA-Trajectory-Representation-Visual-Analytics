from __future__ import annotations

import math
import zlib
from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.neighbors import BallTree


def _stable_hash(text: str) -> int:
    return int(zlib.adler32(text.encode("utf-8")) & 0xFFFFFFFF)


def _get_point_lng_lat(feature: Dict[str, Any]) -> Tuple[float, float]:
    geometry = feature.get("geometry") or {}
    coords = geometry.get("coordinates") or []
    if not isinstance(coords, list) or len(coords) < 2:
        raise ValueError("Point geometry coordinates must be [lng, lat]")
    lng = float(coords[0])
    lat = float(coords[1])
    if not (math.isfinite(lng) and math.isfinite(lat)):
        raise ValueError("Invalid lng/lat")
    return lng, lat


def _safe_str(value: Any, fallback: str = "unknown") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def run_traj_vectorize(
    traj_collection: Dict[str, Any],
    poi_collection: Dict[str, Any],
    *,
    radius_m: float,
    vector_dim: int = 256,
    poi_category_field: str = "category",
    coord_system: str = "gcj02",
) -> Dict[str, Any]:
    """
    Build per-trajectory-point embeddings by counting POIs within radius.
    Assumes traj+poi are in the same coordinate system (default: GCJ02 degrees).
    """
    if radius_m <= 0 or not math.isfinite(radius_m):
        raise ValueError("radius_m must be a positive number")
    if vector_dim < 8 or vector_dim > 4096:
        raise ValueError("vector_dim must be in [8, 4096]")

    traj_features = traj_collection.get("features")
    poi_features = poi_collection.get("features")
    if not isinstance(traj_features, list) or len(traj_features) == 0:
        raise ValueError("trajectory collection must include non-empty features")
    if not isinstance(poi_features, list) or len(poi_features) == 0:
        raise ValueError("poi collection must include non-empty features")

    # BallTree(haversine) expects [lat, lng] in radians.
    poi_latlng = np.zeros((len(poi_features), 2), dtype=np.float64)
    poi_cats: List[str] = []
    poi_ids: List[str] = []
    poi_names: List[str] = []
    for i, feature in enumerate(poi_features):
        lng, lat = _get_point_lng_lat(feature)
        poi_latlng[i, 0] = math.radians(lat)
        poi_latlng[i, 1] = math.radians(lng)
        props = feature.get("properties") or {}
        poi_cats.append(_safe_str((props or {}).get(poi_category_field), fallback="unknown"))
        poi_ids.append(_safe_str((props or {}).get("id"), fallback=f"poi_{i}"))
        poi_names.append(_safe_str((props or {}).get("name"), fallback=f"POI {i}"))

    tree = BallTree(poi_latlng, metric="haversine")
    earth_radius_m = 6371008.8
    radius_rad = float(radius_m) / earth_radius_m

    out = {"type": "FeatureCollection", "features": []}
    max_poi_ids = 500
    topk_categories = 6
    for idx, feature in enumerate(traj_features):
        lng, lat = _get_point_lng_lat(feature)
        query = np.asarray([[math.radians(lat), math.radians(lng)]], dtype=np.float64)
        ind = tree.query_radius(query, r=radius_rad, return_distance=False)[0]

        vec = np.zeros((vector_dim,), dtype=np.float32)
        cat_counts: Dict[str, int] = {}
        poi_ids_in_radius: List[str] = []
        poi_names_in_radius: List[str] = []
        for poi_idx in ind.tolist():
            cat = poi_cats[poi_idx]
            bucket = _stable_hash(cat) % vector_dim
            vec[bucket] += 1.0
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            if len(poi_ids_in_radius) < max_poi_ids:
                poi_ids_in_radius.append(poi_ids[poi_idx])
                poi_names_in_radius.append(poi_names[poi_idx])

        # L2 normalize, keeps similarity stable across dense/sparse neighborhoods.
        norm = float(np.linalg.norm(vec))
        if norm > 1e-6:
            vec /= norm

        props = (feature.get("properties") or {}).copy()
        props["embedding"] = vec.tolist()
        props["vec"] = props["embedding"]
        props["coord_system"] = coord_system
        props["radius_m"] = float(radius_m)
        props["poi_in_radius"] = int(len(ind))
        props["poi_ids"] = poi_ids_in_radius
        props["poi_names"] = poi_names_in_radius[: min(len(poi_names_in_radius), 50)]
        props["poi_unique_categories"] = int(len(cat_counts))
        top_cats = sorted(cat_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:topk_categories]
        props["poi_top_categories"] = [{"category": k, "count": int(v)} for k, v in top_cats]
        props["poi_top_category"] = top_cats[0][0] if top_cats else "unknown"
        props.setdefault("metric", float(len(ind)))
        out["features"].append(
            {
                "type": "Feature",
                "geometry": feature.get("geometry"),
                "properties": props,
            }
        )

    return out
