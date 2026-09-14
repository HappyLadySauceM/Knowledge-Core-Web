import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackendShell } from "@/components/studio/backend-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/en/studio/media",
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, refresh: vi.fn() }),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">Theme</button>,
}));

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const session = {
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

describe("BackendShell", () => {
  beforeEach(() => {
    navigation.pathname = "/en/studio/media";
    navigation.params = new URLSearchParams();
    navigation.push.mockReset();
    navigation.replace.mockReset();
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps public navigation out of the backend and exposes the active module", async () => {
    renderWithQuery(<BackendShell locale="en" profile={{ title: "HappyLadySauce", tagline_zh: "", tagline_en: "", hero_image_url: "", hero_focal_x: 50, hero_focal_y: 50, revision: 1 }}>content</BackendShell>);
    expect(await screen.findByText("alice")).toBeVisible();
    expect(screen.getByRole("link", { name: "Media library" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Articles" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications")).toBeVisible();
  });

  it("submits global searches to the document workspace", async () => {
    renderWithQuery(<BackendShell locale="en" profile={{ title: "HappyLadySauce", tagline_zh: "", tagline_en: "", hero_image_url: "", hero_focal_x: 50, hero_focal_y: 50, revision: 1 }}>content</BackendShell>);
    const search = await screen.findByRole("textbox", { name: "Search documents…" });
    fireEvent.change(search, { target: { value: "notes" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/en/studio?q=notes"));
  });

  it("persists the collapsed sidebar preference", async () => {
    renderWithQuery(<BackendShell locale="en" profile={{ title: "HappyLadySauce", tagline_zh: "", tagline_en: "", hero_image_url: "", hero_focal_x: 50, hero_focal_y: 50, revision: 1 }}>content</BackendShell>);
    fireEvent.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("complementary")).toHaveClass("is-collapsed");
    await waitFor(() => expect(window.localStorage.getItem("knowledge-core:studio-sidebar-collapsed")).toBe("true"));
  });
});
