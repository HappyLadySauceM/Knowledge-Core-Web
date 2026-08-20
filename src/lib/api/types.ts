import { z } from "zod";

export const ProblemDetailsSchema = z.object({ type: z.string().optional(), title: z.string(), status: z.number(), detail: z.string().optional(), instance: z.string().optional(), trace_id: z.string().optional() });
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
export type SessionUser = { id: string; email: string; displayName: string; avatarUrl?: string };
export type DocumentSummary = { id: string; title: string; slug: string; updatedAt: string; visibility: "private" | "public" };
export type Folder = { id: string; name: string; parentId: string | null; depth: number };
