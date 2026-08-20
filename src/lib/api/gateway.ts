import { ProblemDetailsSchema } from "@/lib/api/types";

const gatewayBaseUrl = process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? "http://localhost:8080";

export async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${gatewayBaseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  if (!response.ok) {
    const problem = ProblemDetailsSchema.safeParse(await response.json().catch(() => null));
    throw new Error(problem.success ? problem.data.detail ?? problem.data.title : `Gateway request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
