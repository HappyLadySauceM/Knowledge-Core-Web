import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";

const { mockPush, mockReplace, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: mockRefresh }),
}));

describe("AuthForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
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

  it("links a register email conflict only to sign-in", async () => {
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
    expect(screen.queryByRole("link", { name: "重新发送验证邮件" })).toBeNull();
  });

  it("sends a successful registration to the login page", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "1", username: "alice" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<AuthForm locale="zh-CN" mode="register" />);
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "创建账号" }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/zh-CN/login?registered=1");
    });
  });

  it("replaces the login page with Studio after a successful login", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
    render(<AuthForm locale="zh-CN" mode="login" />);
    fireEvent.change(screen.getByLabelText("邮箱或用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "继续" }).closest("form")!);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/zh-CN/studio"));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("only follows a same-locale next path after login", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
    render(<AuthForm locale="en" mode="login" next="https://evil.example/phishing" />);
    fireEvent.change(screen.getByLabelText("Email or username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/en/studio"));
  });
});
