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

const { useEditorMock } = vi.hoisted(() => ({
  useEditorMock: vi.fn((_options?: { extensions?: unknown[] }, _deps?: unknown[]) => null),
}));

vi.mock("@tiptap/react", () => ({
  useEditor: (options?: { extensions?: unknown[] }, deps?: unknown[]) => useEditorMock(options, deps),
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
    isSynced = false;
    whenSynced = new Promise(() => undefined);
    destroy() {}
    retry() {}
    resync() { return Promise.resolve(); }
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

function renderEditor(locale = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentEditor documentId="doc_1" locale={locale} />
    </QueryClientProvider>,
  );
}

async function openShare() {
  fireEvent.click(await screen.findByRole("button", { name: "Share" }));
}

async function openMoreItem(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("DocumentEditor chrome", () => {
  beforeEach(() => {
    useEditorMock.mockClear();
    vi.mocked(documentsApi.get).mockResolvedValue({ data: documentSummary });
    vi.mocked(documentsApi.remove).mockReset();
    vi.mocked(documentsApi.publish).mockReset();
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

  it("puts the title in the writing surface and page-top share/mode/more/publish chrome", async () => {
    renderEditor();
    expect(await screen.findByDisplayValue("Draft one")).toBeVisible();
    expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Editing mode" })).toBeVisible();
    expect(screen.getByRole("button", { name: "More" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Members" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Versions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText(/Type \/ to insert/)).toBeNull();
    expect(screen.getByText(/alice/)).toBeVisible();
  });

  it("shows Chinese copy instead of Gateway sequence mismatch text", async () => {
    vi.mocked(documentsApi.get).mockResolvedValue({
      data: { ...documentSummary, publication_status: "publish_failed", publication_error: "document sequence does not match" },
    });
    renderEditor("zh-CN");
    expect(await screen.findByText("文档尚未同步完成，请稍后再发布。")).toBeVisible();
    expect(screen.queryByText(/document sequence does not match/i)).toBeNull();
  });

  it("keeps settings without a title field and versions behind the more menu", async () => {
    renderEditor();
    await openMoreItem("Document settings");
    expect(await screen.findByRole("heading", { name: "Document settings" })).toBeVisible();
    expect(document.querySelector("form input[name='title']")).toBeNull();
    expect(screen.getByDisplayValue("Draft one")).toBeVisible();
  });

  it("localizes the former English chrome labels", async () => {
    renderEditor("zh-CN");
    expect(await screen.findByRole("button", { name: "分享" })).toBeVisible();
    expect(screen.getByRole("button", { name: "发布" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "编辑模式" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByText("Connected")).toBeNull();
    expect(screen.queryByText("Publish")).toBeNull();
  });

  it("mounts TipTap with studio extensions before collaboration is ready", async () => {
    renderEditor();
    expect(await screen.findByRole("button", { name: "Share" })).toBeVisible();
    expect(useEditorMock).toHaveBeenCalled();
    const options = useEditorMock.mock.calls[0]?.[0];
    expect(Array.isArray(options?.extensions)).toBe(true);
    expect(options?.extensions?.length).toBeGreaterThan(0);
  });

  it("does not add a member when the invite dialog is cancelled", async () => {
    renderEditor();
    expect(await screen.findByRole("button", { name: "Share" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    await openShare();
    fireEvent.click(await screen.findByRole("button", { name: "Add member" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(membersApi.add).not.toHaveBeenCalled();
  });

  it("does not remove a member when the confirm dialog is cancelled", async () => {
    renderEditor();
    await openShare();
    fireEvent.click(await screen.findByRole("button", { name: "Remove member" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(membersApi.remove).not.toHaveBeenCalled();
  });

  it("does not create a version when the label dialog is cancelled", async () => {
    renderEditor();
    await openMoreItem("Version history");
    fireEvent.click(await screen.findByRole("button", { name: "Create version" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(versionsApi.create).not.toHaveBeenCalled();
  });

  it("does not restore a version when the confirm dialog is cancelled", async () => {
    renderEditor();
    await openMoreItem("Version history");
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(versionsApi.get).not.toHaveBeenCalled();
    expect(versionsApi.restore).not.toHaveBeenCalled();
  });

  it("does not delete a document when the trash dialog is cancelled", async () => {
    renderEditor();
    await openMoreItem("Document settings");
    fireEvent.click(await screen.findByRole("button", { name: "Move to trash" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(documentsApi.remove).not.toHaveBeenCalled();
  });
});
