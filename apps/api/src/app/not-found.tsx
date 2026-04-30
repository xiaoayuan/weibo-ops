export default function NotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: "#94a3b8" }}>404</p>
        <h1 style={{ margin: "12px 0 0", fontSize: 36, letterSpacing: "-0.05em" }}>API 路由不存在</h1>
      </div>
    </main>
  );
}
