import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecuritySettings } from "@/components/security-settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderSettings(locale = "zh-CN") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SecuritySettings locale={locale} />
    </QueryClientProvider>,
  );
}

const verifiedSession = {
  user: {
    id: "1",
    username: "alice",
    avatar: "",
    email: "alice@example.com",
    role: "user",
    status: "active",
    bio: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    email_verified_at: "2026-01-01T01:00:00Z",
  },
};

describe("SecuritySettings", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows email verified copy on the account security page", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/bff/auth/session")) {
        return new Response(JSON.stringify(verifiedSession), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    renderSettings();
    expect(await screen.findByRole("status")).toHaveTextContent("邮箱已验证");
  });

  it("does not show verified copy when the email is still pending", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/bff/auth/session")) {
        const pending = { user: { ...verifiedSession.user, email_verified_at: undefined, status: "pending_verification" } };
        return new Response(JSON.stringify(pending), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    renderSettings("en");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Email verified")).toBeNull();
  });
});
