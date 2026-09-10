import { ProblemDetailsSchema, type ProblemDetails } from "@/lib/api/types";
import type { ZodType } from "zod";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly problem: ProblemDetails, public readonly retryAfter?: string) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
  }
}

export type ApiResult<T> = { data: T; etag?: string; location?: string };

export async function apiRequest<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`/api/bff/gateway${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const parsed = ProblemDetailsSchema.safeParse(await response.json().catch(() => null));
    const problem = parsed.success ? parsed.data : { title: `Request failed (${response.status})`, status: response.status };
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("knowledge-core:unauthorized"));
    throw new ApiError(response.status, problem, response.headers.get("retry-after") ?? undefined);
  }
  const data = response.status === 204 ? undefined : schema.parse(await response.json());
  return { data: data as T, etag: response.headers.get("etag") ?? undefined, location: response.headers.get("location") ?? undefined };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bff/gateway${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("knowledge-core:unauthorized"));
    throw new ApiError(response.status, problem ?? { title: `Request failed (${response.status})`, status: response.status }, response.headers.get("retry-after") ?? undefined);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
