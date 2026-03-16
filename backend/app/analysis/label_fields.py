from __future__ import annotations

from typing import Any, Dict, List, Set, Tuple


def discover_label_fields(collection: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Discover reasonable categorical label fields from a GeoJSON FeatureCollection.

    Returned shape matches frontend `LabelFieldMeta`:
    - field: str
    - label: str (human label; currently equals field)
    - unique_count: int
    - coverage: float (0..1)
    """

    features = collection.get("features")
    if not isinstance(features, list) or len(features) == 0:
        return []

    skip: Set[str] = {
        "embedding",
        "vec",
        "vec_3d",
        "emb3",
        "reduction_embedding",
        "neighbors",
        "geometry",
    }
    prioritized: Set[str] = {"cluster_id", "cluster_label"}

    values: Dict[str, Set[str]] = {}
    counts: Dict[str, int] = {}

    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties")
        if not isinstance(props, dict):
            continue
        for key, val in props.items():
            if key in skip:
                continue
            if val is None:
                continue
            if isinstance(val, (list, dict, tuple)):
                continue
            # Treat only scalar values as label candidates.
            text = str(val).strip()
            if not text:
                continue
            values.setdefault(key, set()).add(text)
            counts[key] = counts.get(key, 0) + 1

    total = max(1, len(features))
    items: List[Tuple[str, Set[str]]] = list(values.items())

    fields: List[Dict[str, Any]] = []
    for field, uniq in items:
        unique_count = len(uniq)
        if field not in prioritized:
            if unique_count <= 1:
                continue
            if unique_count > 80:
                continue
        coverage = round((counts.get(field, 0) / total), 4)
        if field not in prioritized and coverage < 0.15:
            continue
        fields.append(
            {
                "field": field,
                "label": field,
                "unique_count": unique_count,
                "coverage": coverage,
            }
        )

    def rank(name: str) -> int:
        return 0 if name in {"info", "cluster_label", "cluster_id"} else 1

    fields.sort(key=lambda item: (rank(str(item.get("field") or "")), str(item.get("field") or "")))
    return fields

