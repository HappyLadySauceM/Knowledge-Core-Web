import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { MemberListSchema, MemberSchema } from "@/lib/api/types";
const base = (id: string) => `/api/v1/studio/documents/${encodeURIComponent(id)}`;
export const membersApi = {
  list: (documentId: string) => apiRequest(`${base(documentId)}/members`, MemberListSchema),
  add: (documentId: string, username: string, role: "viewer" | "editor") => apiRequest(`${base(documentId)}/members`, MemberSchema, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ username, role }) }),
  update: (documentId: string, userId: string, revision: number, role: "viewer" | "editor") => apiRequest(`${base(documentId)}/members/${encodeURIComponent(userId)}`, MemberSchema, { method: "PATCH", headers: { "If-Match": `"${revision}"` }, body: JSON.stringify({ role }) }),
  remove: (documentId: string, userId: string, revision: number) => apiRequest(`${base(documentId)}/members/${encodeURIComponent(userId)}`, z.undefined(), { method: "DELETE", headers: { "If-Match": `"${revision}"` } }),
};
