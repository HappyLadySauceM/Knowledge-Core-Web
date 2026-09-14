import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibrary } from "@/components/studio/media-library";
import { mediaApi } from "@/lib/api/media";

vi.mock("@/components/studio/attachment-uploader", () => ({
  AttachmentUploader: () => null,
}));

vi.mock("@/lib/api/media", () => ({
  mediaApi: {
    list: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
  },
}));

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("MediaLibrary", () => {
  beforeEach(() => {
    vi.mocked(mediaApi.list).mockResolvedValue({ data: { items: [], page: { has_more: false } } });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the studio empty state when there are no assets", async () => {
    renderWithQuery(<MediaLibrary locale="en" />);
    expect(await screen.findByRole("heading", { name: "No media yet" })).toBeVisible();
    expect(screen.getByText("Upload an image, audio, video, or document and it will appear here.")).toBeVisible();
  });

  it("does not trash media when the confirm dialog is cancelled", async () => {
    vi.mocked(mediaApi.list).mockResolvedValue({
      data: {
        items: [{
          id: "att_1",
          owner_id: 1,
          filename: "cover.png",
          media_type: "image/png",
          category: "image",
          size_bytes: 1024,
          sha256: "abc",
          status: "ready",
          part_size: 1024,
          part_count: 1,
          created_at: "2026-01-01T00:00:00Z",
          content_url: "/api/bff/gateway/api/v1/attachments/att_1/content",
        }],
        page: { has_more: false },
      },
    });
    renderWithQuery(<MediaLibrary locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /Trash/ }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mediaApi.remove).not.toHaveBeenCalled();
  });
});
