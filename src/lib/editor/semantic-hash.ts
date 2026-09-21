import type { JSONContent } from "@tiptap/core";

type PublicationHashInput = {
  title: string;
  summary: string;
  slug: string;
  language?: string;
  tags?: string[];
  content: JSONContent;
  plainText: string;
  icon?: string;
  coverAttachmentId?: string;
  coverFocalX?: number;
  coverFocalY?: number;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Rust's serde_json uses its deterministic map ordering for the Collaboration
 * projection hash. TipTap objects are assembled in schema order, so sort keys
 * recursively before hashing to make an unchanged document compare equal
 * across the browser and Collaboration.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function publicationSummary(summary: string, plainText: string) {
  const explicit = summary.trim();
  if (explicit) return explicit;
  const firstLine = plainText.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.slice(0, 1000);
}

/**
 * Matches the Gateway's publication hash input.  The Collaboration snapshot
 * hash is the SHA-256 of a JSON tuple (content, plain text), then the metadata
 * envelope is hashed separately. Keeping this in one helper makes the update
 * button a semantic comparison instead of a connection/revision heuristic.
 */
export async function publicationSemanticHash(input: PublicationHashInput) {
  const contentHash = await sha256(stableJson([input.content, input.plainText]));
  return sha256(stableJson({
    title: input.title,
    summary: publicationSummary(input.summary, input.plainText),
    slug: input.slug,
    language: input.language ?? "zh-CN",
    tags: input.tags ?? [],
    content_hash: contentHash,
    icon: input.icon ?? "",
    cover_attachment_id: input.coverAttachmentId ?? "",
    cover_focal_x: input.coverFocalX ?? null,
    cover_focal_y: input.coverFocalY ?? null,
  }));
}
