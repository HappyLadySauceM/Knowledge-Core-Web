import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { MemberListSchema, MemberSchema, VersionDetailSchema, VersionPageSchema, VersionSchema } from "@/lib/api/types";
const base = (id: string) => `/api/v1/studio/documents/${encodeURIComponent(id)}`;
export const membersApi = {
  list: (documentId: string) => apiRequest(`${base(documentId)}/members`, MemberListSchema),
  add: (documentId: string, username: string, role: "viewer" | "editor") => apiRequest(`${base(documentId)}/members`, MemberSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ username, role }) }),
  update: (documentId: string, userId: string, revision: number, role: "viewer" | "editor") => apiRequest(`${base(documentId)}/members/${encodeURIComponent(userId)}`, MemberSchema, { method: "PATCH", headers: { "If-Match": `"${revision}"` }, body: JSON.stringify({ role }) }),
  remove: (documentId: string, userId: string, revision: number) => apiRequest(`${base(documentId)}/members/${encodeURIComponent(userId)}`, z.undefined(), { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
};
export const versionsApi = {
  list: (documentId: string, cursor?: string) => apiRequest(`${base(documentId)}/versions?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, VersionPageSchema),
  create: (documentId: string, label?: string) => apiRequest(`${base(documentId)}/versions`, VersionSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ ...(label ? { label } : {}) }) }),
  get: (documentId: string, versionId: string) => apiRequest(`${base(documentId)}/versions/${encodeURIComponent(versionId)}`, VersionDetailSchema),
  restore: (documentId: string, versionId: string, expected_sequence: number) => apiRequest(`${base(documentId)}/versions/${encodeURIComponent(versionId)}/restorations`, VersionSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ expected_sequence }) }),
};
