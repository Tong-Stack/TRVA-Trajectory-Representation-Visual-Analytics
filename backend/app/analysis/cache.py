from __future__ import annotations

import hashlib
import json
from typing import Any, Dict

import numpy as np


class AnalysisCache:
    def __init__(self) -> None:
        self._store: Dict[str, Any] = {}

    @staticmethod
    def _fingerprint(embeddings: np.ndarray, params: Dict[str, Any]) -> str:
        hasher = hashlib.sha256()
        hasher.update(embeddings.tobytes())
        hasher.update(str(embeddings.shape).encode("utf-8"))
        hasher.update(json.dumps(params, sort_keys=True, ensure_ascii=False).encode("utf-8"))
        return hasher.hexdigest()

    def _key(self, dataset_id: str, module: str, fingerprint: str) -> str:
        return f"{dataset_id}:{module}:{fingerprint}"

    def get(self, dataset_id: str, module: str, embeddings: np.ndarray, params: Dict[str, Any]) -> Any | None:
        fp = self._fingerprint(embeddings, params)
        return self._store.get(self._key(dataset_id, module, fp))

    def set(self, dataset_id: str, module: str, embeddings: np.ndarray, params: Dict[str, Any], value: Any) -> None:
        fp = self._fingerprint(embeddings, params)
        self._store[self._key(dataset_id, module, fp)] = value
