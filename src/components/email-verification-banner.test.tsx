import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

function renderBanner(locale = "zh-CN") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EmailVerificationBanner locale={locale} />
    </QueryClientProvider>,
  );
}

const unverifiedSession = {
  user: {
    id: "1",
    username: "alice",
    avatar: "",
    email: "alice@example.com",
    role: "user",
    status: "pending_verification",
    bio: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

const verifiedSession = {
  user: { ...unverifiedSession.user, email_verified_at: "2026-01-01T01:00:00Z", status: "active" },
};

describe("EmailVerificationBanner", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders a reminder only for unverified users", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/bff/auth/session")) {
        return new Response(JSON.stringify(unverifiedSession), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ state: "idle" }), { status: 200, headers: { "content-type": "application/json" } });
    });
    renderBanner();
    expect(await screen.findByRole("status")).toHaveTextContent("请验证邮箱");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "发送验证邮件" })).toBeEnabled();
    });
  });

  it("does not render a banner when the email is already verified", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(verifiedSession), { status: 200, headers: { "content-type": "application/json" } }),
    );
    renderBanner("en");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send verification email" })).toBeNull();
  });

  it("disables send during cooldown and shows the retry note beside the button", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/bff/auth/session")) {
        return new Response(JSON.stringify(unverifiedSession), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(
        JSON.stringify({ state: "pending", expires_at: "2026-09-11T04:00:00Z", retry_after_seconds: 1800 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    renderBanner();
    const button = await screen.findByRole("button", { name: "发送验证邮件" });
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByText(/链接将于/)).toHaveTextContent("30 分钟后重试");
    fireEvent.click(button);
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });
});
