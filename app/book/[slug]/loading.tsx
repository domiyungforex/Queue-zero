export default function BookLoading() {
  return (
    <main style={{ width: "min(100%,540px)", margin: "0 auto", padding: 16 }}>
      <div style={{ height: 340, borderRadius: 22, background: "#fef6f0", border: "1px solid #eee7e3", animation: "pulse 1.5s ease-in-out infinite" }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </main>
  );
}
