import { cookies } from "next/headers";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function POST() {
  const cookieStore = await cookies();
  const access = cookieStore.get("kc_access")?.value;
  if (access) await fetch(new URL("/api/v1/sessions/current", gatewayBaseUrl), { method: "DELETE", headers: { authorization: `Bearer ${access}` }, cache: "no-store" }).catch(() => undefined);
  cookieStore.delete("kc_access");
  cookieStore.delete("kc_refresh");
  return Response.json({ ok: true });
}
