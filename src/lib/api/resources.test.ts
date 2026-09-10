import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api/client";
import { documentsApi } from "@/lib/api/documents";
import { DocumentSummarySchema } from "@/lib/api/types";

const document = { id: "doc-1", title: "Title", summary: "", slug: "title-doc", owner: { id: "user-1", username: "alice", avatar: "" }, access: "owner", published: false, publication_status: "draft", metadata_revision: 3, content_revision: 1, created_at: "2026-09-09T00:00:00Z", updated_at: "2026-09-09T00:00:00Z" };

describe("Gateway domain clients", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("validates responses and retains ETag metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(document), { status: 200, headers: { "content-type": "application/json", etag: '"3"' } })));
    const result = await apiRequest("/api/v1/studio/documents/doc-1", DocumentSummarySchema);
    expect(result.data.title).toBe("Title");
    expect(result.etag).toBe('"3"');
  });

  it("sends optimistic concurrency headers for document updates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...document, title: "Next", metadata_revision: 4 }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await documentsApi.update("doc-1", 3, { title: "Next" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("if-match")).toBe('"3"');
  });

  it("maps Problem Details into a typed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: "Conflict", status: 412, key: "knowledge.precondition" }), { status: 412, headers: { "content-type": "application/problem+json" } })));
    await expect(apiRequest("/api/v1/studio/documents/doc-1", DocumentSummarySchema)).rejects.toMatchObject({ status: 412, message: "Conflict" } satisfies Partial<ApiError>);
  });
});
