import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

const root = ReactDOM.createRoot(rootEl);
root.render(<div style={{ padding: 16, opacity: 0.9 }}>Loading...</div>);

// Dynamic import makes module-evaluation failures visible as UI instead of a blank screen.
import("./App")
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[Boot] Failed to load App", err);
    const message = err instanceof Error ? err.stack || err.message : String(err);
    root.render(
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>App 加载失败</div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 12,
            margin: 0,
          }}
        >
          {message}
        </pre>
      </div>
    );
  });
