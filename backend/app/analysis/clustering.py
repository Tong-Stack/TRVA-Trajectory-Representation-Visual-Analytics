from __future__ import annotations

from typing import List, Literal

import numpy as np
from sklearn.cluster import DBSCAN, KMeans



def run_clustering(
    embeddings: np.ndarray,
    method: Literal["kmeans", "cdp", "dbscan", "lgc", "cdc"],
    n_clusters: int = 6,
    eps: float = 0.5,
    min_samples: int = 5,
    k_num: int = 20,
    ratio: float = 0.9,
) -> List[int]:
    sample_count = embeddings.shape[0]
    if sample_count == 0:
        return []
    if sample_count == 1:
        return [0]

    if method in {"kmeans", "lgc"}:
        cluster_count = min(max(1, n_clusters), sample_count)
        labels = KMeans(n_clusters=cluster_count, random_state=42, n_init=10).fit_predict(embeddings)
        return [int(value) for value in labels.tolist()]

    if method in {"dbscan", "cdp"}:
        labels = DBSCAN(eps=eps, min_samples=min_samples, metric="euclidean").fit_predict(embeddings)
        return [int(value) for value in labels.tolist()]

    if method == "cdc":
        # CDC's reference implementation calls SUDE + kNN internally and is fragile on tiny datasets.
        if sample_count < 4:
            return [0 for _ in range(sample_count)]
        try:
            from .my_cdc import cdc_cluster
        except ImportError as exc:
            raise RuntimeError("cdc dependencies are not available. Please install required packages.") from exc

        safe_k_num = max(1, min(int(k_num), sample_count - 1))
        try:
            labels = cdc_cluster(embeddings, safe_k_num, ratio)
            return [int(value) for value in np.asarray(labels).tolist()]
        except Exception:
            # Keep analysis usable by falling back to kmeans.
            cluster_count = min(2, sample_count)
            labels = KMeans(n_clusters=cluster_count, random_state=42, n_init=10).fit_predict(embeddings)
            return [int(value) for value in labels.tolist()]

    raise ValueError(f"Unsupported clustering method: {method}")


        
