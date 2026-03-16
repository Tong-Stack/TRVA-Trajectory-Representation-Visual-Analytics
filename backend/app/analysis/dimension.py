from __future__ import annotations

from typing import Literal

import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import LocallyLinearEmbedding, TSNE
from umap import UMAP


def _fit_to_components(values: np.ndarray, target_components: int) -> np.ndarray:
    if values.ndim != 2:
        raise ValueError("reduction result must be a 2D matrix")
    current_components = values.shape[1]
    if current_components == target_components:
        return np.asarray(values, dtype=np.float64)
    if current_components > target_components:
        return np.asarray(values[:, :target_components], dtype=np.float64)
    padded = np.zeros((values.shape[0], target_components), dtype=np.float64)
    padded[:, :current_components] = values
    return padded


def _run_pca(embeddings: np.ndarray, target_components: int) -> np.ndarray:
    sample_count, feature_count = embeddings.shape
    n_components = min(target_components, sample_count, feature_count)
    reduced = PCA(n_components=n_components, random_state=42).fit_transform(embeddings)
    return _fit_to_components(reduced, target_components)


def _run_sude(
    embeddings: np.ndarray,
    sample_count: int,
    feature_count: int,
    sude_k1: int,
    target_components: int,
) -> np.ndarray:
    try:
        from sude import sude
    except ImportError as exc:
        raise RuntimeError("sude is not installed. Please install `sude`.") from exc

    if feature_count <= target_components:
        # SUDE requires no_dims < original feature dimension.
        return _run_pca(embeddings, target_components)

    safe_k1 = max(1, min(int(sude_k1), sample_count - 1))
    reduced = sude(embeddings, no_dims=target_components, k1=safe_k1)
    return _fit_to_components(np.asarray(reduced, dtype=np.float64), target_components)


def run_dimension(
    embeddings: np.ndarray,
    method: Literal["sude", "pca", "umap", "lle", "tsne"],
    n_components: int = 3,
    n_neighbors: int = 30,
    perplexity: float = 30.0,
    sude_k1: int = 10,
) -> np.ndarray:
    target_components = 2 if n_components == 2 else 3
    sample_count, feature_count = embeddings.shape
    if sample_count == 0:
        return np.empty((0, target_components), dtype=np.float64)
    if sample_count == 1:
        return np.zeros((1, target_components), dtype=np.float64)

    if method == "pca" or sample_count <= target_components:
        return _run_pca(embeddings, target_components)

    try:
        safe_neighbors = min(max(2, n_neighbors), sample_count - 1)
        safe_components = min(target_components, feature_count, sample_count)

        if method == "sude":
            return _run_sude(
                embeddings,
                sample_count=sample_count,
                feature_count=feature_count,
                sude_k1=sude_k1,
                target_components=target_components,
            )

        if method == "umap":
            reduced = UMAP(
                n_components=safe_components,
                n_neighbors=safe_neighbors,
                metric="cosine",
                random_state=42,
                transform_seed=42,
            ).fit_transform(embeddings)
            return _fit_to_components(np.asarray(reduced, dtype=np.float64), target_components)

        if method == "lle":
            lle = LocallyLinearEmbedding(
                n_components=min(target_components, feature_count, max(1, sample_count - 1)),
                n_neighbors=safe_neighbors,
                method="standard",
            )
            reduced = lle.fit_transform(embeddings)
            return _fit_to_components(np.asarray(reduced, dtype=np.float64), target_components)

        if method == "tsne":
            safe_perplexity = min(max(5.0, float(perplexity)), float(sample_count - 1))
            if safe_perplexity <= 1:
                return _run_pca(embeddings, target_components)
            tsne = TSNE(
                n_components=target_components,
                random_state=42,
                perplexity=safe_perplexity,
                init="pca",
                learning_rate="auto",
            )
            reduced = tsne.fit_transform(embeddings)
            return np.asarray(reduced, dtype=np.float64)

        raise ValueError(f"Unsupported dimension method: {method}")
    except RuntimeError:
        raise
    except Exception:
        # Fallback keeps analysis usable on tiny or degenerate datasets where nonlinear methods may fail.
        return _run_pca(embeddings, target_components)
