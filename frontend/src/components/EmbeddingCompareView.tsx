import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { EmbeddingView, type EmbeddingCameraState } from "./EmbeddingView";

export function EmbeddingCompareView() {
  const { labelFields, compareLabelTop, compareLabelBottom, setCompareLabelTop, setCompareLabelBottom } =
    useAppStore();
  const [cameraState, setCameraState] = useState<EmbeddingCameraState | null>(null);

  const options = labelFields.length > 0 ? labelFields : [{ field: "info", label: "info" }];
  const labelFieldKey = useMemo(
    () => options.map((item) => item.field).join("|"),
    [options]
  );
  const initializedFieldKeyRef = useRef<string>("");

  useEffect(() => {
    if (initializedFieldKeyRef.current === labelFieldKey) return;
    const hasInfo = options.some((item) => item.field === "info");
    const hasClusterLabel = options.some((item) => item.field === "cluster_label");
    const hasClusterId = options.some((item) => item.field === "cluster_id");
    const preferredTop = hasInfo ? "info" : options[0]?.field ?? "info";
    const preferredBottom = hasClusterLabel
      ? "cluster_label"
      : hasClusterId
        ? "cluster_id"
        : options.find((item) => item.field !== preferredTop)?.field ?? preferredTop;
    if (compareLabelTop !== preferredTop) setCompareLabelTop(preferredTop);
    if (compareLabelBottom !== preferredBottom) setCompareLabelBottom(preferredBottom);
    initializedFieldKeyRef.current = labelFieldKey;
  }, [compareLabelBottom, compareLabelTop, labelFieldKey, options, setCompareLabelBottom, setCompareLabelTop]);

  return (
    <div className="embedding-compare">
      <div className="compare-toolbar">
        <label className="compare-field">
          <span>上:</span>
          <select value={compareLabelTop} onChange={(e) => setCompareLabelTop(e.target.value)}>
            {options.map((item) => (
              <option key={item.field} value={item.field}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="compare-field">
          <span>下:</span>
          <select value={compareLabelBottom} onChange={(e) => setCompareLabelBottom(e.target.value)}>
            {options.map((item) => (
              <option key={item.field} value={item.field}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="compare-swap-btn"
          onClick={() => {
            const top = compareLabelTop;
            setCompareLabelTop(compareLabelBottom);
            setCompareLabelBottom(top);
          }}
        >
          交换
        </button>
      </div>
      <div className="compare-grid">
        <EmbeddingView
          labelFieldOverride={compareLabelTop}
          title={`表征空间（上）· ${compareLabelTop}`}
          syncId="top"
          syncState={cameraState}
          onSyncCamera={setCameraState}
        />
        <EmbeddingView
          labelFieldOverride={compareLabelBottom}
          title={`表征空间（下）· ${compareLabelBottom}`}
          syncId="bottom"
          syncState={cameraState}
          onSyncCamera={setCameraState}
        />
      </div>
    </div>
  );
}
