import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("AuthForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders Chinese labels and a forgot-password link on zh-CN login", () => {
    render(<AuthForm locale="zh-CN" mode="login" />);
    expect(screen.getByLabelText("邮箱或用户名")).toBeVisible();
    expect(screen.getByLabelText("密码")).toBeVisible();
    expect(screen.getByRole("button", { name: "继续" })).toBeVisible();
    expect(screen.getByRole("link", { name: "忘记密码？" })).toHaveAttribute("href", "/zh-CN/forgot-password");
  });

  it("links a register email conflict to sign-in and verification", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ key: "identity.email_conflict", detail: "email already exists" }), {
        status: 409,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    render(<AuthForm locale="zh-CN" mode="register" />);
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "创建账号" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("该邮箱已注册");
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/zh-CN/login");
    expect(screen.getByRole("link", { name: "重新发送验证邮件" })).toHaveAttribute(
      "href",
      "/zh-CN/verify-email?email=alice%40example.com",
    );
  });

  it("links an unverified login to the verification page", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ key: "identity.email_not_verified", detail: "email verification is required" }), {
        status: 403,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    render(<AuthForm locale="en" mode="login" />);
    fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Verify your email before signing in");
    expect(screen.getByRole("link", { name: "Request a new verification link" })).toHaveAttribute(
      "href",
      "/en/verify-email?email=alice%40example.com",
    );
  });
});
