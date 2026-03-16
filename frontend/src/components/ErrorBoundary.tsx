import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // Ensure the error is visible even when overlays are disabled.
    // eslint-disable-next-line no-console
    console.error("[UI ErrorBoundary]", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const message = error instanceof Error ? error.stack || error.message : String(error);
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>前端运行时错误</div>
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
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          打开浏览器 DevTools Console 可以看到更完整的报错信息。
        </div>
      </div>
    );
  }
}

