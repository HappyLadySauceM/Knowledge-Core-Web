import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentEditor } from "@/components/studio/document-editor";
import { membersApi, versionsApi } from "@/lib/api/collaboration";
import { documentsApi } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    whenSynced = new Promise(() => undefined);
    destroy() {}
  },
}));

vi.mock("@/lib/collaboration/provider", () => ({
  KnowledgeWebSocketProvider: class {
    destroy() {}
    retry() {}
  },
}));

vi.mock("@/lib/api/documents", () => ({
  documentsApi: {
    get: vi.fn(),
    remove: vi.fn(),
    session: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/api/folders", () => ({
  foldersApi: { list: vi.fn() },
}));

vi.mock("@/lib/api/collaboration", () => ({
  membersApi: { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() },
  versionsApi: { list: vi.fn(), create: vi.fn(), get: vi.fn(), restore: vi.fn() },
}));

const documentSummary = {
  id: "doc_1",
  title: "Draft one",
  summary: "",
  slug: "draft-one",
  owner: { id: "u1", username: "alice", avatar: "" },
  access: "owner",
  published: false,
  publication_status: "draft" as const,
  metadata_revision: 3,
  content_revision: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const member = {
  user: { id: "u2", username: "bob", avatar: "" },
  role: "viewer" as const,
  revision: 4,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const version = {
  id: "ver_1",
  document_id: "doc_1",
  sequence: 2,
  kind: "manual",
  label: "checkpoint",
  created_by: { id: "u1", username: "alice", avatar: "" },
  created_at: "2026-01-02T00:00:00Z",
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentEditor documentId="doc_1" locale="en" />
    </QueryClientProvider>,
  );
}

async function openPanel(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
}

describe("DocumentEditor dialogs", () => {
  beforeEach(() => {
    vi.mocked(documentsApi.get).mockResolvedValue({ data: documentSummary });
    vi.mocked(documentsApi.remove).mockReset();
    vi.mocked(foldersApi.list).mockResolvedValue({ data: { items: [] } });
    vi.mocked(membersApi.list).mockResolvedValue({ data: { items: [member] } });
    vi.mocked(membersApi.add).mockReset();
    vi.mocked(membersApi.remove).mockReset();
    vi.mocked(versionsApi.list).mockResolvedValue({ data: { items: [version], page: { has_more: false } } });
    vi.mocked(versionsApi.create).mockReset();
    vi.mocked(versionsApi.get).mockReset();
    vi.mocked(versionsApi.restore).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not add a member when the invite dialog is cancelled", async () => {
    renderEditor();
    await openPanel("Members");
    fireEvent.click(await screen.findByRole("button", { name: "Add member" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(membersApi.add).not.toHaveBeenCalled();
  });

  it("does not remove a member when the confirm dialog is cancelled", async () => {
    renderEditor();
    await openPanel("Members");
    fireEvent.click(await screen.findByRole("button", { name: "Remove member" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(membersApi.remove).not.toHaveBeenCalled();
  });

  it("does not create a version when the label dialog is cancelled", async () => {
    renderEditor();
    await openPanel("Versions");
    fireEvent.click(await screen.findByRole("button", { name: "Create version" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(versionsApi.create).not.toHaveBeenCalled();
  });

  it("does not restore a version when the confirm dialog is cancelled", async () => {
    renderEditor();
    await openPanel("Versions");
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(versionsApi.get).not.toHaveBeenCalled();
    expect(versionsApi.restore).not.toHaveBeenCalled();
  });

  it("does not delete a document when the trash dialog is cancelled", async () => {
    renderEditor();
    await openPanel("Settings");
    fireEvent.click(await screen.findByRole("button", { name: "Move to trash" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(documentsApi.remove).not.toHaveBeenCalled();
  });
});
