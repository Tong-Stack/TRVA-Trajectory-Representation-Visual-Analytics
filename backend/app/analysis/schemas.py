from __future__ import annotations

from typing import Any, Dict, Literal

from pydantic import BaseModel, Field, field_validator


class DimensionParams(BaseModel):
    n_components: int = Field(default=3)
    n_neighbors: int = Field(default=30, ge=2)
    perplexity: float = Field(default=30.0, gt=0)
    sude_k1: int = Field(default=10, ge=2)

    @field_validator("n_components")
    @classmethod
    def validate_n_components(cls, value: int) -> int:
        if value not in {2, 3}:
            raise ValueError("n_components must be 2 or 3")
        return value


class DimensionConfig(BaseModel):
    enabled: bool = True
    method: Literal["sude", "pca", "umap", "lle", "tsne"] = "sude"
    params: DimensionParams = Field(default_factory=DimensionParams)


class ClusteringParams(BaseModel):
    n_clusters: int = Field(default=6, ge=2)
    eps: float = Field(default=0.5, gt=0)
    min_samples: int = Field(default=5, ge=1)
    k_num: int = Field(default=20, ge=1)
    ratio: float = Field(default=0.9, gt=0, lt=1)


class ClusteringConfig(BaseModel):
    enabled: bool = True
    method: Literal["kmeans", "cdp", "dbscan", "lgc", "cdc"] = "cdc"
    params: ClusteringParams = Field(default_factory=ClusteringParams)


class SimilarityConfig(BaseModel):
    enabled: bool = True
    method: Literal["cosine", "dot", "euclidean"] = "cosine"
    top_k: int = Field(default=50, ge=1, le=500)


class SamplingConfig(BaseModel):
    enabled: bool = True
    threshold: int = Field(default=20000, ge=1)
    max_samples: int = Field(default=5000, ge=1)
    strategy: Literal["metric_top"] = "metric_top"

    @field_validator("max_samples")
    @classmethod
    def validate_max_samples(cls, value: int, info: Any) -> int:
        threshold = info.data.get("threshold")
        if isinstance(threshold, int) and value > threshold:
            raise ValueError("max_samples must be <= threshold")
        return value


class GridAnalysisRequest(BaseModel):
    dataset_id: str = Field(..., min_length=1)
    dimension: DimensionConfig = Field(default_factory=DimensionConfig)
    clustering: ClusteringConfig = Field(default_factory=ClusteringConfig)
    similarity: SimilarityConfig = Field(default_factory=SimilarityConfig)
    sampling: SamplingConfig = Field(default_factory=SamplingConfig)

    def cache_payload(self) -> Dict[str, Any]:
        return {
            "dimension": self.dimension.model_dump(),
            "clustering": self.clustering.model_dump(),
            "similarity": self.similarity.model_dump(),
            "sampling": self.sampling.model_dump(),
        }
