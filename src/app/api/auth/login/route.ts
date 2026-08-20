import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.identifier !== "string" || typeof payload.password !== "string") return NextResponse.json({ title: "Invalid request", status: 400 }, { status: 400 });
  const response = await fetch(new URL("/api/v1/sessions", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  if (typeof data.access_token !== "string") return NextResponse.json({ title: "Invalid gateway response", status: 502 }, { status: 502 });
  const cookieStore = await cookies();
  cookieStore.set("kc_access", data.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60 });
  if (typeof data.refresh_token === "string") cookieStore.set("kc_refresh", data.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/auth", maxAge: 30 * 24 * 60 * 60 });
  return NextResponse.json({ user: data.user, expires_at: data.expires_at });
}
