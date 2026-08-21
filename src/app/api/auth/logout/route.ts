import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function POST(request: Request) {
	const origin = request.headers.get("origin");
	if (origin !== new URL(request.url).origin) return NextResponse.json({ title: "Invalid origin", status: 403 }, { status: 403 });
	const cookieStore = await cookies();
	let access = cookieStore.get("kc_access")?.value;
	const refresh = cookieStore.get("kc_refresh")?.value;
	const revoke = async () => access ? fetch(new URL("/api/v1/sessions/current", gatewayBaseUrl), { method: "DELETE", headers: { authorization: `Bearer ${access}` }, cache: "no-store" }) : null;
	let response = await revoke();
	if (response?.status === 401 && refresh) {
		const refreshed = await fetch(new URL("/api/v1/sessions/refresh", gatewayBaseUrl), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store" }).catch(() => null);
		const data = await refreshed?.json().catch(() => null);
		if (refreshed?.ok && typeof data?.access_token === "string") {
			access = data.access_token;
			response = await revoke();
		}
	}
	const result = NextResponse.json({ ok: true });
	result.cookies.delete("kc_access");
	result.cookies.delete("kc_refresh");
	return result;
}
