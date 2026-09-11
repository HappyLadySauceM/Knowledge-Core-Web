import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountActionForm } from "@/components/account-action-form";

describe("AccountActionForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("keeps a verification token hidden and auto-submits it", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ key: "identity.invalid_input", detail: "invalid identity input" }), {
        status: 400,
        headers: { "content-type": "application/problem+json" },
      }),
    );

    render(<AccountActionForm action="verify-email" locale="zh-CN" token="ka1.test-token" />);

    const token = document.querySelector('input[name="token"]') as HTMLInputElement | null;
    expect(token).not.toBeNull();
    expect(token).toHaveAttribute("type", "hidden");
    expect(token).toHaveValue("ka1.test-token");
    expect(screen.queryByLabelText("Token")).toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/bff/auth/verify-email",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("验证链接无效");
  });

  it("does not render a blank token field without a verification token", () => {
    render(<AccountActionForm action="verify-email" locale="en" email="alice@example.com" />);
    expect(document.querySelector('input[name="token"]')).toBeNull();
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
  });

  it("hides the reset token and keeps the new password field", () => {
    render(<AccountActionForm action="reset-password" locale="en" token="ka1.reset-token" />);
    const token = document.querySelector('input[name="token"]') as HTMLInputElement | null;
    expect(token).toHaveAttribute("type", "hidden");
    expect(token).toHaveValue("ka1.reset-token");
    expect(screen.queryByLabelText("Token")).toBeNull();
    expect(screen.getByLabelText("New password")).toBeVisible();
  });

  it("does not render a blank token field without a reset token", () => {
    render(<AccountActionForm action="reset-password" locale="en" />);
    expect(document.querySelector('input[name="token"]')).toBeNull();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Open the reset link from your email");
  });
});
