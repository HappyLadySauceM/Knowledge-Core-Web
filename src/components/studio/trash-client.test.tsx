import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrashClient } from "@/components/studio/trash-client";
import { documentsApi } from "@/lib/api/documents";

vi.mock("@/lib/api/documents", () => ({
  documentsApi: {
    trash: vi.fn(),
    restore: vi.fn(),
    purge: vi.fn(),
  },
}));

function renderTrash(locale = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TrashClient locale={locale} />
    </QueryClientProvider>,
  );
}

describe("TrashClient", () => {
  beforeEach(() => {
    vi.mocked(documentsApi.trash).mockResolvedValue({ data: { items: [], page: { has_more: false } } });
    vi.mocked(documentsApi.purge).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the trash view focused on its controls", async () => {
    renderTrash();
    expect(await screen.findByText("Trash is empty.")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByText("Back to studio")).toBeNull();
  });

  it("requires confirmation before permanently deleting a trashed document", async () => {
    vi.mocked(documentsApi.trash).mockResolvedValueOnce({
      data: {
        items: [{
          id: "doc-1", title: "Old note", summary: "", slug: "old-note",
          owner: { id: "u1", username: "alice", avatar: "" }, access: "owner", published: false,
          publication_status: "draft", metadata_revision: 4, content_revision: 2,
          created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          deleted_at: "2026-01-02T00:00:00Z",
        }],
        page: { has_more: false },
      },
    });
    vi.mocked(documentsApi.trash).mockResolvedValue({ data: { items: [], page: { has_more: false } } });
    vi.mocked(documentsApi.purge).mockResolvedValue({ data: undefined });
    renderTrash();
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(documentsApi.purge).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(documentsApi.purge).toHaveBeenCalledWith("doc-1", 4));
    await waitFor(() => expect(screen.queryByText("Old note")).toBeNull());
  });

  it("keeps a trashed document visible and reports a retryable error when purge fails", async () => {
    vi.mocked(documentsApi.trash).mockResolvedValue({
      data: {
        items: [{
          id: "doc-2", title: "Retry note", summary: "", slug: "retry-note",
          owner: { id: "u1", username: "alice", avatar: "" }, access: "owner", published: false,
          publication_status: "draft", metadata_revision: 8, content_revision: 2,
          created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
          deleted_at: "2026-01-02T00:00:00Z",
        }],
        page: { has_more: false },
      },
    });
    vi.mocked(documentsApi.purge).mockRejectedValue(new Error("Service unavailable"));
    renderTrash();
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete permanently" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByText("Retry note")).toBeVisible();
  });
});
