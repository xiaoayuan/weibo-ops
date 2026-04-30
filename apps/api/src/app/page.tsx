export default function ApiHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 760,
          border: "1px solid rgba(148, 163, 184, 0.18)",
          borderRadius: 24,
          background: "rgba(15, 23, 42, 0.72)",
          boxShadow: "0 24px 60px rgba(2, 8, 20, 0.24)",
          padding: 32,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>
          API Service
        </p>
        <h1 style={{ margin: "16px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.05em" }}>
          weibo-ops 独立后端入口
        </h1>
        <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.8, color: "#cbd5e1" }}>
          当前服务用于承接独立前端请求，并逐步把旧单体应用里的 API 原生迁移到 `apps/api`。
        </p>
        <div
          style={{
            marginTop: 24,
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.16)",
            background: "rgba(15, 23, 42, 0.56)",
            padding: 16,
            fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13,
            color: "#7dd3fc",
          }}
        >
          GET /api
        </div>
      </section>
    </main>
  );
}
