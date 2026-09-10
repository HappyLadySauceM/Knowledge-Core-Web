import { apiRequest } from "@/lib/api/client";
import { ConfigurationDeliverySchema, ConfigurationSchema } from "@/lib/api/types";
export type ConfigurationNamespace = "site" | "email" | "ai";
export const adminApi = {
  get: (namespace: ConfigurationNamespace) => apiRequest(`/api/v1/admin/configuration/${namespace}`, ConfigurationSchema),
  put: (namespace: ConfigurationNamespace, revision: number, values: Record<string, string>) => apiRequest(`/api/v1/admin/configuration/${namespace}`, ConfigurationSchema, { method: "PUT", headers: { "If-Match": `"${revision}"`, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ values }) }),
  delivery: (namespace: ConfigurationNamespace, revision: number) => apiRequest(`/api/v1/admin/configuration/${namespace}/deliveries/${revision}`, ConfigurationDeliverySchema),
};
