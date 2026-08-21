import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";
const routes: Record<string, string> = {
  "verify-email": "/api/v1/email-verifications",
  "request-verification": "/api/v1/email-verification-requests",
  "request-password-reset": "/api/v1/password-reset-requests",
  "reset-password": "/api/v1/password-resets",
  refresh: "/api/v1/sessions/refresh",
  sessions: "/api/v1/sessions",
  "logout-all": "/api/v1/sessions",
  deactivate: "/api/v1/users/me/deactivation",
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) { return handle(request, (await context.params).path); }
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) { return handle(request, (await context.params).path); }
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) { return handle(request, (await context.params).path); }

async function handle(request: Request, path: string[]) {
	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		const origin = request.headers.get("origin");
		if (origin !== new URL(request.url).origin) return NextResponse.json({ title: "Invalid origin", status: 403 }, { status: 403 });
	}
  const [name, id] = path;
  const target = routes[name];
  if (!target) return NextResponse.json({ title: "Auth route not found", status: 404 }, { status: 404 });
  const cookieStore = await cookies();
  const headers = new Headers({ "content-type": "application/json" });
  const access = cookieStore.get("kc_access")?.value;
  const refresh = cookieStore.get("kc_refresh")?.value;
  if (access) headers.set("authorization", `Bearer ${access}`);
  let endpoint = target;
  if (name === "sessions" && id) endpoint += `/${encodeURIComponent(id)}`;
  const body = name === "refresh" && refresh ? JSON.stringify({ refresh_token: refresh }) : request.method === "GET" || request.method === "DELETE" ? undefined : await request.arrayBuffer();
  const upstreamMethod = name === "logout-all" ? "DELETE" : request.method;
	let response = await fetch(new URL(endpoint, gatewayBaseUrl), { method: upstreamMethod, headers, body, cache: "no-store" });
	if (response.status === 401 && name !== "refresh" && refresh) {
		const refreshed = await fetch(new URL("/api/v1/sessions/refresh", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store" });
		const refreshData = await refreshed.json().catch(() => ({}));
		if (refreshed.ok && typeof refreshData.access_token === "string") {
			headers.set("authorization", `Bearer ${refreshData.access_token}`);
			response = await fetch(new URL(endpoint, gatewayBaseUrl), { method: upstreamMethod, headers, body, cache: "no-store" });
			cookieStore.set("kc_access", refreshData.access_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 15 * 60 });
			if (typeof refreshData.refresh_token === "string") cookieStore.set("kc_refresh", refreshData.refresh_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", path: "/", maxAge: 30 * 24 * 60 * 60 });
		}
	}
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json(data, { status: response.status });
	if (typeof data.access_token === "string") cookieStore.set("kc_access", data.access_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 15 * 60 });
	if (typeof data.refresh_token === "string") cookieStore.set("kc_refresh", data.refresh_token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", path: "/", maxAge: 30 * 24 * 60 * 60 });
  if (name === "logout-all") { cookieStore.delete("kc_access"); cookieStore.delete("kc_refresh"); }
  return NextResponse.json({ ...data, access_token: undefined, refresh_token: undefined }, { status: response.status });
}
