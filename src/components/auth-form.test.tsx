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

  it("links a register email conflict to sign-in and verification", async () => {
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
    expect(screen.getByRole("link", { name: "Request a new verification link" })).toHaveAttribute(
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
