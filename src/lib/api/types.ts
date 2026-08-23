import { z } from "zod";

export const ProblemDetailsSchema = z.object({ type: z.string().optional(), title: z.string(), status: z.number(), detail: z.string().optional(), instance: z.string().optional(), trace_id: z.string().optional() });
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
export type SessionUser = { id: string; username: string; email: string; role: string; status: string; avatar: string; bio: string; created_at: string; updated_at: string };
export type SessionData = { user: SessionUser; access_token?: string; token_type?: string; expires_at?: string };
export type DocumentSummary = { id: string; title: string; summary: string; slug: string; owner: { id: string; username: string; avatar: string }; access: string; published: boolean; metadata_revision: number; content_revision: number; published_at?: string; deleted_at?: string; projected_at?: string; created_at: string; updated_at: string; language?: string; tags?: string[]; folder_id?: string };
export type DocumentDetail = { document: DocumentSummary; content: { type: string; content?: unknown[] }; plain_text: string; attachments: Attachment[] };
export type Attachment = { id: string; document_id: string; filename: string; media_type: string; size_bytes: number; status: string; content_url: string; created_at: string };
export type DocumentPage = { items: DocumentSummary[]; page: { next_cursor?: string; has_more: boolean } };
export type Folder = { id: string; name: string; parent_id?: string; depth: number; revision: number; created_at: string; updated_at: string };
export type FolderList = { items: Folder[] };
export type RichTextNode = { type: string; attrs?: Record<string, unknown>; content?: RichTextNode[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };
export type SiteProfile = { title: string; tagline_zh: string; tagline_en: string; hero_image_url: string; hero_focal_x: number; hero_focal_y: number; revision: number };
