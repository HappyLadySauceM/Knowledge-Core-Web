import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrashClient } from "@/components/studio/trash-client";
import { documentsApi } from "@/lib/api/documents";

vi.mock("@/lib/api/documents", () => ({
  documentsApi: {
    trash: vi.fn(),
    restore: vi.fn(),
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
});
