const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function POST(request: Request) {
	const origin = request.headers.get("origin");
	if (origin !== new URL(request.url).origin) return Response.json({ title: "Invalid origin", status: 403 }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.username !== "string" || typeof payload.email !== "string" || typeof payload.password !== "string") return Response.json({ title: "Invalid request", status: 400 }, { status: 400 });
  const response = await fetch(new URL("/api/v1/users", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  return Response.json(data, { status: response.status });
}
