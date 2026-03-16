from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np


def extract_embeddings(collection: Dict[str, Any]) -> Tuple[np.ndarray, List[str]]:
    if collection.get("type") != "FeatureCollection":
        raise ValueError("Only FeatureCollection is supported")

    features = collection.get("features")
    if not isinstance(features, list) or len(features) == 0:
        raise ValueError("FeatureCollection must include non-empty features")

    ids: List[str] = []
    vectors: List[List[float]] = []
    expected_dim: int | None = None

    for idx, feature in enumerate(features):
        if not isinstance(feature, dict):
            raise ValueError(f"feature[{idx}] must be an object")
        props = feature.get("properties")
        if not isinstance(props, dict):
            raise ValueError(f"feature[{idx}].properties must be an object")

        feature_id = props.get("id")
        if not isinstance(feature_id, str) or feature_id.strip() == "":
            raise ValueError(f"feature[{idx}] missing valid properties.id")

        embedding = props.get("embedding")
        if not isinstance(embedding, list) or len(embedding) == 0:
            raise ValueError(f"feature[{idx}] missing valid properties.embedding")

        try:
            vector = [float(item) for item in embedding]
        except (TypeError, ValueError) as exc:
            raise ValueError(f"feature[{idx}].properties.embedding must be numeric") from exc

        if expected_dim is None:
            expected_dim = len(vector)
        elif len(vector) != expected_dim:
            raise ValueError("All embedding vectors must have the same dimension")

        ids.append(feature_id)
        vectors.append(vector)

    matrix = np.asarray(vectors, dtype=np.float64)
    return matrix, ids
