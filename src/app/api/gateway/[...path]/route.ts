import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

async function forward(request: Request, path: string[]) {
	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		const origin = request.headers.get("origin");
		if (origin !== new URL(request.url).origin) return NextResponse.json({ title: "Invalid origin", status: 403 }, { status: 403 });
	}
  const cookieStore = await cookies();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["if-match", "idempotency-key", "x-request-id", "traceparent", "tracestate"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
	const accessToken = cookieStore.get("kc_access")?.value;
	const refresh = cookieStore.get("kc_refresh")?.value;
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const url = new URL(`/${path.join("/")}`, gatewayBaseUrl);
  url.search = new URL(request.url).search;
	const outgoingBody = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
	let response = await fetch(url, {
		method: request.method,
		headers,
		body: outgoingBody,
		cache: "no-store",
	});
	if (response.status === 401 && refresh) {
		const refreshed = await fetch(new URL("/api/v1/sessions/refresh", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store" });
		const refreshData = await refreshed.json().catch(() => ({}));
		if (refreshed.ok && typeof refreshData.access_token === "string") {
			headers.set("authorization", `Bearer ${refreshData.access_token}`);
			response = await fetch(url, { method: request.method, headers, body: outgoingBody, cache: "no-store" });
			cookieStore.set("kc_access", refreshData.access_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 15 * 60 });
			if (typeof refreshData.refresh_token === "string") cookieStore.set("kc_refresh", refreshData.refresh_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", path: "/", maxAge: 30 * 24 * 60 * 60 });
		}
	}
	const responseBody = await response.arrayBuffer();
  const responseHeaders = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) responseHeaders.set("content-type", responseType);
  for (const name of ["etag", "location", "x-request-id", "x-trace-id", "retry-after", "www-authenticate"]) {
    const value = response.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
	return new NextResponse(responseBody, { status: response.status, headers: responseHeaders });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) { return forward(request, (await context.params).path); }
