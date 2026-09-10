import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { FolderListSchema, FolderSchema } from "@/lib/api/types";
export const foldersApi = {
  list: (parentId?: string) => apiRequest(`/api/v1/studio/folders${parentId ? `?parent_id=${encodeURIComponent(parentId)}` : ""}`, FolderListSchema),
  create: (name: string, parent_id?: string) => apiRequest("/api/v1/studio/folders", FolderSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ name, ...(parent_id ? { parent_id } : {}) }) }),
  update: (id: string, revision: number, body: { name?: string; parent_id?: string }) => apiRequest(`/api/v1/studio/folders/${encodeURIComponent(id)}`, FolderSchema, { method: "PATCH", headers: { "If-Match": `"${revision}"` }, body: JSON.stringify(body) }),
  remove: (id: string, revision: number) => apiRequest(`/api/v1/studio/folders/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
};
