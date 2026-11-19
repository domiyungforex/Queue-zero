export function GET() {
  return Response.json(
    { ok: true, service: "turnmark", role: "liveness" },
    { headers: { "cache-control": "no-store" } },
  );
}
