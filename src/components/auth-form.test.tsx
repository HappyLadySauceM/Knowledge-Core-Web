import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

describe("AuthForm", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockPush.mockReset();
    mockRefresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("links a register email conflict only to sign-in", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ key: "identity.email_conflict", detail: "email already exists" }), {
        status: 409,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    render(<AuthForm locale="zh-CN" mode="register" />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("This email is already registered");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/zh-CN/login");
    expect(screen.queryByRole("link", { name: "Request a new verification link" })).toBeNull();
  });

  it("sends a successful registration to the login page", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "1", username: "alice" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<AuthForm locale="zh-CN" mode="register" />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/zh-CN/login?registered=1");
    });
  });
});
