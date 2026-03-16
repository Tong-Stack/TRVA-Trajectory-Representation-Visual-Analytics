from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..analysis.schemas import ClusteringConfig, DimensionConfig, SamplingConfig, SimilarityConfig


class PoiUploadResponse(BaseModel):
    poi_dataset_id: str
    poi_count: int


class TrajUploadResponse(BaseModel):
    traj_dataset_id: str
    point_count: int


class TrajAnalysisRequest(BaseModel):
    traj_dataset_id: str = Field(..., min_length=1)
    poi_dataset_id: str = Field(..., min_length=1)
    radius_m: float = Field(..., gt=0)
    vector_dim: int = Field(default=256, ge=8, le=4096)
    poi_category_field: str = Field(default="category", min_length=1)
    coord_system: Literal["gcj02", "wgs84", "bd09"] = "gcj02"

    dimension: DimensionConfig = Field(default_factory=DimensionConfig)
    clustering: ClusteringConfig = Field(default_factory=ClusteringConfig)
    similarity: SimilarityConfig = Field(default_factory=SimilarityConfig)
    sampling: SamplingConfig = Field(default_factory=SamplingConfig)

