import { useEffect, useMemo, useRef, useState } from "react";
import type { PaletteId, PaletteOption } from "../utils/colors";

export function PaletteDropdown({
  value,
  options,
  onChange,
}: {
  value: PaletteId;
  options: PaletteOption[];
  onChange: (next: PaletteId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => options.find((item) => item.id === value) ?? options[0],
    [options, value]
  );

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !rootRef.current) return;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div className="palette-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`palette-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="palette-text">
          <span className="palette-name">{selected?.label ?? "配色方案"}</span>
          <span className="palette-desc">{selected?.description ?? ""}</span>
        </span>
        {selected && (
          <span className="palette-mini-bar" aria-hidden="true">
            {selected.swatches.map((color, idx) => (
              <span key={`${selected.id}-${idx}`} style={{ backgroundColor: color }} />
            ))}
          </span>
        )}
        <span className="palette-caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="palette-menu" role="listbox">
          {options.map((item) => (
            <button
              type="button"
              key={item.id}
              role="option"
              aria-selected={item.id === value}
              className={`palette-option ${item.id === value ? "active" : ""}`}
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
            >
              <span className="palette-text">
                <span className="palette-name">{item.label}</span>
                <span className="palette-desc">{item.description}</span>
              </span>
              <span className="palette-mini-bar" aria-hidden="true">
                {item.swatches.map((color, idx) => (
                  <span key={`${item.id}-${idx}`} style={{ backgroundColor: color }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
