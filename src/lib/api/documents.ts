import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { CollaborationSessionSchema, DocumentPageSchema, DocumentSummarySchema } from "@/lib/api/types";

export type DocumentFilters = { q?: string; cursor?: string; access?: "owner" | "shared"; publication?: "published" | "draft"; limit?: number };
function query(filters: DocumentFilters = {}) { const p = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") p.set(key, String(value)); }); return p.size ? `?${p}` : ""; }
export const documentsApi = {
  list: (filters?: DocumentFilters) => apiRequest(`/api/v1/studio/documents${query(filters)}`, DocumentPageSchema),
  trash: (filters?: DocumentFilters) => apiRequest(`/api/v1/studio/trash${query(filters)}`, DocumentPageSchema),
  get: (id: string) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}`, DocumentSummarySchema),
  create: (body: { title: string; summary?: string; slug?: string }) => apiRequest("/api/v1/studio/documents", DocumentSummarySchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }),
  update: (id: string, revision: number, body: Partial<{ title: string; summary: string; slug: string; language: string; tags: string[]; folder_id: string }>) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}`, DocumentSummarySchema, { method: "PATCH", headers: { "If-Match": `"${revision}"` }, body: JSON.stringify(body) }),
  remove: (id: string, revision: number) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
  restore: (id: string) => apiRequest(`/api/v1/studio/trash/${encodeURIComponent(id)}/restore`, DocumentSummarySchema, { method: "POST" }),
  session: (id: string) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}/collaboration-sessions`, CollaborationSessionSchema, { method: "POST" }),
  publish: (id: string, revision: number, stateVector: string) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}/publication`, DocumentSummarySchema, { method: "PUT", headers: { "If-Match": `"${revision}"`, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ state_vector: stateVector }) }),
  unpublish: (id: string, revision: number) => apiRequest(`/api/v1/studio/documents/${encodeURIComponent(id)}/publication`, z.undefined(), { method: "DELETE", headers: { "If-Match": `"${revision}"`, "Idempotency-Key": crypto.randomUUID() } }),
};
