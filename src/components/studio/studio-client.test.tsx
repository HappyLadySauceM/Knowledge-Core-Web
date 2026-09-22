import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudioClient, StudioFolders } from "@/components/studio/studio-client";
import { documentsApi } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";

const navigationState = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationState.router,
  useSearchParams: () => navigationState.searchParams,
}));

vi.mock("@/lib/api/documents", () => ({
  documentsApi: {
    list: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
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

describe("Studio dialogs and URL filters", () => {
  beforeEach(() => {
    navigationState.searchParams = new URLSearchParams();
    vi.mocked(foldersApi.list).mockResolvedValue({ data: { items: [folder] } });
    vi.mocked(foldersApi.create).mockReset();
    vi.mocked(foldersApi.update).mockReset();
    vi.mocked(foldersApi.remove).mockReset();
    vi.mocked(documentsApi.list).mockResolvedValue({ data: { items: [], page: { has_more: false } } });
    vi.mocked(documentsApi.create).mockReset();
    vi.mocked(documentsApi.remove).mockReset();
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

  it("shows filtered-empty copy when a folder URL has no documents", async () => {
    navigationState.searchParams = new URLSearchParams("folder=fld_1");
    renderWithQuery(<StudioClient locale="en" />);
    expect(await screen.findByText("No documents match these filters")).toBeVisible();
    expect(screen.getByText("Try another search, folder, or publication state — or create a new document.")).toBeVisible();
    expect(screen.getByLabelText("Access")).toBeVisible();
  });

  it("uses document search and folder values from the URL", async () => {
    navigationState.searchParams = new URLSearchParams("q=notes&folder=fld_1");
    vi.mocked(documentsApi.list).mockResolvedValue({
      data: {
        items: [{ ...documentSummary, folder_id: "fld_1" }],
        page: { has_more: false },
      },
    });
    renderWithQuery(<StudioClient locale="en" />);
    await waitFor(() => expect(documentsApi.list).toHaveBeenCalledWith(expect.objectContaining({ q: "notes", folder_id: "fld_1" })));
    expect(await screen.findByRole("heading", { name: "Notes" })).toBeVisible();
  });

  it("renders personal and knowledge library roots", async () => {
    renderWithQuery(<StudioFolders locale="en" />);
    expect(await screen.findByRole("button", { name: "My document library" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Knowledge base" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Shared with me" })).toBeVisible();
  });

  it("moves an owned document to trash from the document list", async () => {
    vi.mocked(documentsApi.list).mockResolvedValue({ data: { items: [documentSummary], page: { has_more: false } } });
    vi.mocked(documentsApi.remove).mockResolvedValue({ data: undefined });
    renderWithQuery(<StudioClient locale="en" />);

    fireEvent.click(await screen.findByRole("button", { name: "Move to trash Notes" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(documentsApi.remove).toHaveBeenCalledWith("doc_1", 1));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull());
  });
});
