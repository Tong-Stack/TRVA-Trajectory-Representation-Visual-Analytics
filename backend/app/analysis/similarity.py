from __future__ import annotations

from typing import Dict, List, Literal

import numpy as np
from sklearn.neighbors import NearestNeighbors


def _normalize_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    safe_norms = np.where(norms == 0, 1.0, norms)
    return matrix / safe_norms


def _knn_neighbors(
    embeddings: np.ndarray,
    ids: List[str],
    top_k: int,
    method: Literal["cosine", "euclidean"],
) -> List[List[Dict[str, float]]]:
    sample_count = embeddings.shape[0]
    if sample_count <= 1:
        return [[] for _ in ids]

    k = min(top_k, sample_count - 1)
    knn = NearestNeighbors(n_neighbors=k + 1, metric=method)
    knn.fit(embeddings)
    distances, indices = knn.kneighbors(embeddings, return_distance=True)

    rows: List[List[Dict[str, float]]] = []
    for row_idx in range(sample_count):
        row: List[Dict[str, float]] = []
        for dist, target_idx in zip(distances[row_idx], indices[row_idx]):
            if target_idx == row_idx:
                continue
            if method == "cosine":
                score = 1.0 - float(dist)
            else:
                score = 1.0 / (1.0 + float(dist))
            row.append({"id": ids[target_idx], "score": round(score, 6)})
            if len(row) >= k:
                break
        rows.append(row)
    return rows


def _dot_neighbors_chunked(embeddings: np.ndarray, ids: List[str], top_k: int, chunk_size: int = 256) -> List[List[Dict[str, float]]]:
    sample_count = embeddings.shape[0]
    if sample_count <= 1:
        return [[] for _ in ids]

    k = min(top_k, sample_count - 1)
    normalized = _normalize_rows(embeddings)
    results: List[List[Dict[str, float]]] = [[] for _ in range(sample_count)]

    for start in range(0, sample_count, chunk_size):
        end = min(sample_count, start + chunk_size)
        chunk = normalized[start:end]
        scores = chunk @ normalized.T

        for row_offset, row_idx in enumerate(range(start, end)):
            scores[row_offset, row_idx] = -np.inf
            row_scores = scores[row_offset]
            if k >= row_scores.size:
                top_indices = np.argsort(row_scores)[::-1]
            else:
                partition_idx = np.argpartition(row_scores, -k)[-k:]
                top_indices = partition_idx[np.argsort(row_scores[partition_idx])[::-1]]

            row: List[Dict[str, float]] = []
            for col_idx in top_indices:
                score_value = float(row_scores[col_idx])
                if not np.isfinite(score_value):
                    continue
                row.append({"id": ids[int(col_idx)], "score": round(score_value, 6)})
            results[row_idx] = row

    return results


def run_similarity(
    embeddings: np.ndarray,
    ids: List[str],
    method: Literal["cosine", "dot", "euclidean"],
    top_k: int,
) -> List[List[Dict[str, float]]]:
    if method in {"cosine", "euclidean"}:
        return _knn_neighbors(embeddings, ids, top_k=top_k, method=method)
    return _dot_neighbors_chunked(embeddings, ids, top_k=top_k)
