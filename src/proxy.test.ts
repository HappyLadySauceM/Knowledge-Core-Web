import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

function request(path: string, options: { cookies?: string; prefetch?: boolean } = {}) {
  const headers = new Headers();
  if (options.cookies) headers.set("cookie", options.cookies);
  if (options.prefetch) headers.set("next-router-prefetch", "1");
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("proxy", () => {
  it("redirects an unauthenticated Studio document request to login with next", () => {
    const response = proxy(request("/zh-CN/studio"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/zh-CN/login?next=%2Fzh-CN%2Fstudio");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not cache a prefetch of a gated route as a login redirect", () => {
    const response = proxy(request("/zh-CN/studio", { prefetch: true }));
    expect(response.status).toBe(204);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("lets a session cookie through to Studio", () => {
    const response = proxy(request("/zh-CN/studio", { cookies: "kc_access=test-access" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
