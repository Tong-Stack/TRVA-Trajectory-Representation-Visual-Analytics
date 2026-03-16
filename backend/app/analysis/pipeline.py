from __future__ import annotations

import copy
import logging
from typing import Any, Callable, Dict, Optional

from .cache import AnalysisCache
from .label_fields import discover_label_fields
from .clustering import run_clustering
from .dimension import run_dimension
from .extract import extract_embeddings
from .schemas import GridAnalysisRequest
from .similarity import run_similarity

logger = logging.getLogger(__name__)


ProgressCallback = Callable[[int, str, str], None]


def _notify(progress: Optional[ProgressCallback], value: int, stage: str, message: str) -> None:
    if progress:
        progress(value, stage, message)


def _safe_metric(feature: Dict[str, Any]) -> float:
    props = feature.get("properties", {})
    value = props.get("metric", 0)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _prepare_collection_with_sampling(
    collection: Dict[str, Any], payload: GridAnalysisRequest
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    features = collection.get("features")
    if not isinstance(features, list):
        raise ValueError("FeatureCollection.features must be an array")

    total = len(features)
    sampling = payload.sampling
    if not sampling.enabled or total <= sampling.threshold:
        return collection, {
            "enabled": bool(sampling.enabled),
            "truncated": False,
            "strategy": sampling.strategy,
            "threshold": sampling.threshold,
            "max_samples": sampling.max_samples,
            "total": total,
            "shown": total,
        }

    sorted_features = sorted(features, key=_safe_metric, reverse=True)
    sampled = sorted_features[: sampling.max_samples]
    sampled_collection: Dict[str, Any] = {
        "type": collection.get("type", "FeatureCollection"),
        "features": sampled,
    }
    return sampled_collection, {
        "enabled": True,
        "truncated": True,
        "strategy": sampling.strategy,
        "threshold": sampling.threshold,
        "max_samples": sampling.max_samples,
        "total": total,
        "shown": len(sampled),
    }


def _infer_default_label_field(label_fields: list[Dict[str, Any]]) -> str:
    ranked = ["info", "cluster_label", "cluster_id", "class", "name", "id"]
    existing = {item["field"] for item in label_fields}
    for field in ranked:
        if field in existing:
            return field
    return label_fields[0]["field"] if label_fields else "info"


def run_grid_analysis(
    collection: Dict[str, Any],
    payload: GridAnalysisRequest,
    cache: AnalysisCache,
    progress: Optional[ProgressCallback] = None,
) -> Dict[str, Any]:
    logger.info("grid-analysis started dataset_id=%s", payload.dataset_id)
    _notify(progress, 5, "sampling", "Preparing dataset")
    working_collection, sampling_meta = _prepare_collection_with_sampling(collection, payload)

    _notify(progress, 10, "extract", "Extracting embeddings")
    embeddings, ids = extract_embeddings(working_collection)
    logger.info("embedding extracted: samples=%s dims=%s", embeddings.shape[0], embeddings.shape[1])

    reduced_embeddings = None
    clusters = None
    neighbors = None

    if payload.dimension.enabled:
        _notify(progress, 25, "dimension", f"Running dimension method={payload.dimension.method}")
        params = payload.dimension.model_dump()
        cached = cache.get(payload.dataset_id, "dimension", embeddings, params)
        if cached is None:
            logger.info("dimension cache miss dataset_id=%s method=%s", payload.dataset_id, payload.dimension.method)
            cached = run_dimension(
                embeddings=embeddings,
                method=payload.dimension.method,
                n_components=payload.dimension.params.n_components,
                n_neighbors=payload.dimension.params.n_neighbors,
                perplexity=payload.dimension.params.perplexity,
                sude_k1=payload.dimension.params.sude_k1,
            )
            cache.set(payload.dataset_id, "dimension", embeddings, params, cached)
        else:
            logger.info("dimension cache hit dataset_id=%s method=%s", payload.dataset_id, payload.dimension.method)
        reduced_embeddings = cached
    else:
        logger.info("dimension disabled dataset_id=%s", payload.dataset_id)

    if payload.clustering.enabled:
        _notify(progress, 50, "clustering", f"Running clustering method={payload.clustering.method}")
        params = payload.clustering.model_dump()
        cached = cache.get(payload.dataset_id, "clustering", embeddings, params)
        if cached is None:
            logger.info("clustering cache miss dataset_id=%s method=%s", payload.dataset_id, payload.clustering.method)
            cached = run_clustering(
                embeddings=embeddings,
                method=payload.clustering.method,
                n_clusters=payload.clustering.params.n_clusters,
                eps=payload.clustering.params.eps,
                min_samples=payload.clustering.params.min_samples,
                k_num=payload.clustering.params.k_num,
                ratio=payload.clustering.params.ratio,
            )
            cache.set(payload.dataset_id, "clustering", embeddings, params, cached)
        else:
            logger.info("clustering cache hit dataset_id=%s method=%s", payload.dataset_id, payload.clustering.method)
        clusters = cached
    else:
        logger.info("clustering disabled dataset_id=%s", payload.dataset_id)

    if payload.similarity.enabled:
        _notify(progress, 72, "similarity", f"Running similarity method={payload.similarity.method}")
        params = payload.similarity.model_dump()
        cached = cache.get(payload.dataset_id, "similarity", embeddings, params)
        if cached is None:
            logger.info("similarity cache miss dataset_id=%s method=%s", payload.dataset_id, payload.similarity.method)
            cached = run_similarity(
                embeddings=embeddings,
                ids=ids,
                method=payload.similarity.method,
                top_k=payload.similarity.top_k,
            )
            cache.set(payload.dataset_id, "similarity", embeddings, params, cached)
        else:
            logger.info("similarity cache hit dataset_id=%s method=%s", payload.dataset_id, payload.similarity.method)
        neighbors = cached
    else:
        logger.info("similarity disabled dataset_id=%s", payload.dataset_id)

    _notify(progress, 90, "finalize", "Merging analysis result into GeoJSON")
    output = copy.deepcopy(working_collection)
    for idx, feature in enumerate(output.get("features", [])):
        props = feature.setdefault("properties", {})
        if payload.dimension.enabled and reduced_embeddings is not None:
            props["reduction_embedding"] = [float(value) for value in reduced_embeddings[idx].tolist()]
        if payload.clustering.enabled and clusters is not None:
            cluster_id = int(clusters[idx])
            props["cluster_id"] = cluster_id
            props["cluster_label"] = f"Cluster {cluster_id}" if cluster_id >= 0 else "Noise"
        if payload.similarity.enabled and neighbors is not None:
            props["neighbors"] = neighbors[idx]

    label_fields = discover_label_fields(output)
    output["meta"] = {
        "sampling": sampling_meta,
        "label_fields": label_fields,
        "active_label_default": _infer_default_label_field(label_fields),
    }

    logger.info("grid-analysis completed dataset_id=%s", payload.dataset_id)
    _notify(progress, 100, "done", "Analysis completed")
    return output
