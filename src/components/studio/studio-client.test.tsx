import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioClient, StudioFolders } from "@/components/studio/studio-client";
import { documentsApi } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import { SEARCH_DEBOUNCE_MS } from "@/lib/use-debounced-value";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api/documents", () => ({
  documentsApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/api/folders", () => ({
  foldersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const folder = {
  id: "fld_1",
  name: "Notes",
  depth: 0,
  revision: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const documentSummary = {
  id: "doc_1",
  title: "Notes",
  summary: "A note",
  slug: "notes",
  owner: { id: "u1", username: "ada", avatar: "" },
  access: "owner",
  published: false,
  publication_status: "draft" as const,
  metadata_revision: 1,
  content_revision: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Studio dialogs and search", () => {
  beforeEach(() => {
    vi.mocked(foldersApi.list).mockResolvedValue({ data: { items: [folder] } });
    vi.mocked(foldersApi.create).mockReset();
    vi.mocked(foldersApi.update).mockReset();
    vi.mocked(foldersApi.remove).mockReset();
    vi.mocked(documentsApi.list).mockResolvedValue({ data: { items: [], page: { has_more: false } } });
    vi.mocked(documentsApi.create).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not call the folder API when the delete dialog is cancelled", async () => {
    renderWithQuery(<StudioFolders locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete folder Notes" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(foldersApi.remove).not.toHaveBeenCalled();
  });

  it("does not create a document when the create dialog is cancelled", async () => {
    renderWithQuery(<StudioClient locale="en" />);
    fireEvent.click((await screen.findAllByRole("button", { name: "New document" }))[0]);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(documentsApi.create).not.toHaveBeenCalled();
  });

  it("renders a two-column workspace and a primary empty state", async () => {
    const { container } = renderWithQuery(<StudioClient locale="en" />);
    expect(container.querySelector(".studio-workspace")).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "All documents" })).toBeVisible();
    expect(await screen.findByRole("status")).toHaveTextContent("Start with one clear idea");
    expect(screen.getByRole("status")).toHaveTextContent("Draft a note, an essay, or a research thread");
    expect(screen.getAllByRole("button", { name: "New document" }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Search documents")).toBeNull();
  });

  it("shows filtered-empty copy when a folder has no documents", async () => {
    renderWithQuery(<StudioClient locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /▱\s*Notes/ }));
    expect(await screen.findByText("No documents match these filters")).toBeVisible();
    expect(screen.getByText("Try another search, folder, or publication state — or create a new document.")).toBeVisible();
    expect(screen.getByLabelText("Search documents")).toBeVisible();
  });

  it("debounces document search before querying Gateway", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue({ data: { items: [documentSummary], page: { has_more: false } } });
    renderWithQuery(<StudioClient locale="en" />);
    expect(await screen.findByRole("heading", { level: 2, name: "Notes" })).toBeVisible();
    const initialCalls = vi.mocked(documentsApi.list).mock.calls.length;
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search documents"), { target: { value: "notes" } });
    expect(documentsApi.list).toHaveBeenCalledTimes(initialCalls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(documentsApi.list).toHaveBeenCalledTimes(initialCalls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(documentsApi.list).toHaveBeenCalledWith(expect.objectContaining({ q: "notes" }));
  });
});
