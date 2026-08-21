import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const access = cookieStore.get("kc_access")?.value;
  const refresh = cookieStore.get("kc_refresh")?.value;
  if (!access) return NextResponse.json({ user: null });
  let response = await fetch(new URL("/api/v1/users/me", gatewayBaseUrl), { headers: { authorization: `Bearer ${access}` }, cache: "no-store" });
  if (response.status === 401 && refresh) {
    const refreshed = await fetch(new URL("/api/v1/sessions/refresh", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store" });
    const refreshData = await refreshed.json().catch(() => ({}));
    if (refreshed.ok && typeof refreshData.access_token === "string") {
      response = await fetch(new URL("/api/v1/users/me", gatewayBaseUrl), { headers: { authorization: `Bearer ${refreshData.access_token}` }, cache: "no-store" });
      const result = NextResponse.json(response.ok ? { user: await response.json().catch(() => ({})) } : { user: null }, { status: response.ok ? 200 : response.status });
      const secure = new URL(request.url).protocol === "https:";
      result.cookies.set("kc_access", refreshData.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 15 * 60 });
      if (typeof refreshData.refresh_token === "string") result.cookies.set("kc_refresh", refreshData.refresh_token, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 30 * 24 * 60 * 60 });
      return result;
    }
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) return NextResponse.json({ user: null });
  return NextResponse.json(response.ok ? { user: data } : data, { status: response.status });
}
