import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { MediaAttachmentListSchema, MediaAttachmentSchema, MediaAttachmentUploadSchema } from "@/lib/api/types";
export const mediaApi = {
  list: (filters: { status?: string; category?: string; cursor?: string; limit?: number } = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); }); return apiRequest(`/api/v1/attachments${p.size ? `?${p}` : ""}`, MediaAttachmentListSchema); },
  get: (id: string) => apiRequest(`/api/v1/attachments/${encodeURIComponent(id)}`, MediaAttachmentSchema),
  create: (body: { filename: string; media_type: string; size_bytes: number }) => apiRequest("/api/v1/attachments", MediaAttachmentUploadSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }),
  complete: (id: string, body: { upload_id: string; parts: { part_number: number; etag: string }[] }) => apiRequest(`/api/v1/attachments/${encodeURIComponent(id)}/complete`, MediaAttachmentSchema, { method: "POST", body: JSON.stringify(body) }),
  remove: (id: string) => apiRequest(`/api/v1/attachments/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE" }),
  restore: (id: string) => apiRequest(`/api/v1/attachments/${encodeURIComponent(id)}/restore`, MediaAttachmentSchema, { method: "POST" }),
};
