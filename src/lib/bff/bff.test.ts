/** @vitest-environment node */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuth } from "@/lib/bff/auth";
import { GET as handleGateway, POST as handleGatewayPost } from "@/app/api/bff/gateway/[...path]/route";

const gatewayOrigin = "http://gateway.test";
const webOrigin = "http://localhost:3000";

function request(path: string, options: { method?: string; body?: string; cookies?: string; origin?: string; contentLength?: string } = {}) {
	const headers = new Headers();
	if (options.body !== undefined) headers.set("content-type", "application/json");
	if (options.cookies) headers.set("cookie", options.cookies);
	if (options.origin !== undefined) headers.set("origin", options.origin);
	if (options.contentLength) headers.set("content-length", options.contentLength);
	return new NextRequest(`http://localhost:3000${path}`, { method: options.method ?? "GET", headers, body: options.body });
}

function jsonResponse(value: unknown, status = 200) {
	return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

const authentication = {
	user: { id: "user-1", username: "alice" },
	access_token: "access-new",
	refresh_token: "refresh-new",
	expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
};

describe("web BFF session layer", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		process.env.KNOWLEDGE_CORE_GATEWAY_URL = gatewayOrigin;
		process.env.KNOWLEDGE_CORE_WEB_ORIGIN = webOrigin;
		process.env.KNOWLEDGE_CORE_GATEWAY_TIMEOUT_MS = "30000";
		vi.stubGlobal("fetch", fetchMock);
		fetchMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.KNOWLEDGE_CORE_GATEWAY_URL;
		delete process.env.KNOWLEDGE_CORE_WEB_ORIGIN;
		delete process.env.KNOWLEDGE_CORE_GATEWAY_TIMEOUT_MS;
	});

	it("creates HttpOnly cookies and strips session tokens from login response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(authentication));
		const response = await handleAuth(request("/api/bff/auth/login", { method: "POST", origin: webOrigin, body: JSON.stringify({ identifier: "alice", password: "password" }) }), ["login"]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user: authentication.user, expires_at: authentication.expires_at });
		expect(response.headers.get("set-cookie")).toContain("kc_access=access-new");
		expect(response.headers.get("set-cookie")).toContain("kc_refresh=refresh-new");
		expect(response.headers.get("set-cookie")).toContain("HttpOnly");
		expect(response.headers.get("set-cookie")).not.toContain("access_token");
	});

	it("does not establish a session from an expired Gateway response", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ ...authentication, expires_at: new Date(Date.now() - 1_000).toISOString() }));
		const response = await handleAuth(request("/api/bff/auth/login", { method: "POST", origin: webOrigin, body: JSON.stringify({ identifier: "alice", password: "password" }) }), ["login"]);

		expect(response.status).toBe(502);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("rejects cross-origin mutations before calling Gateway", async () => {
		const response = await handleAuth(request("/api/bff/auth/login", { method: "POST", origin: "https://evil.test", body: "{}" }), ["login"]);

		expect(response.status).toBe(403);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps credential endpoints out of the generic Gateway proxy", async () => {
		const response = await handleGatewayPost(request("/api/bff/gateway/api/v1/sessions", { method: "POST", origin: webOrigin, body: JSON.stringify({ identifier: "alice", password: "password" }) }), { params: Promise.resolve({ path: ["api", "v1", "sessions"] }) });

		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refreshes once after a Gateway 401 and retries with the new access token", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Unauthorized", status: 401 }, 401));
		fetchMock.mockResolvedValueOnce(jsonResponse(authentication));
		fetchMock.mockResolvedValueOnce(jsonResponse({ id: "user-1", username: "alice" }));

		const response = await handleGateway(request("/api/bff/gateway/api/v1/users/me", { cookies: "kc_access=access-old; kc_refresh=refresh-old" }), { params: Promise.resolve({ path: ["api", "v1", "users", "me"] }) });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: "user-1", username: "alice" });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer access-old");
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify({ refresh_token: "refresh-old" }) });
		expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("authorization")).toBe("Bearer access-new");
		expect(response.headers.get("set-cookie")).toContain("kc_access=access-new");
	});

	it("hydrates the session from a refresh-only cookie", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(authentication));
		fetchMock.mockResolvedValueOnce(jsonResponse(authentication.user));

		const response = await handleAuth(request("/api/bff/auth/session", { cookies: "kc_refresh=refresh-old" }), ["session"]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user: authentication.user });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("authorization")).toBe("Bearer access-new");
		expect(response.headers.get("set-cookie")).toContain("kc_refresh=refresh-new");
	});

	it("clears stale cookies when refresh is rejected", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Unauthorized", status: 401 }, 401));
		fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Unauthorized", status: 401 }, 401));

		const response = await handleGateway(request("/api/bff/gateway/api/v1/users/me", { cookies: "kc_access=access-old; kc_refresh=refresh-old" }), { params: Promise.resolve({ path: ["api", "v1", "users", "me"] }) });

		expect(response.status).toBe(401);
		expect(response.headers.get("set-cookie")).toContain("kc_access=;");
		expect(response.headers.get("set-cookie")).toContain("kc_refresh=;");
	});

	it("returns a bounded problem when the request body is too large", async () => {
		const response = await handleGateway(request("/api/bff/gateway/api/v1/studio/documents", { method: "POST", origin: webOrigin, contentLength: String(4 * 1024 * 1024 + 1) }), { params: Promise.resolve({ path: ["api", "v1", "studio", "documents"] }) });

		expect(response.status).toBe(413);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("always clears local cookies on logout, including Gateway failure", async () => {
		fetchMock.mockRejectedValueOnce(new Error("connection refused"));
		const response = await handleAuth(request("/api/bff/auth/logout", { method: "POST", origin: webOrigin, cookies: "kc_access=access-old; kc_refresh=refresh-old" }), ["logout"]);

		expect(response.status).toBe(502);
		expect(response.headers.get("set-cookie")).toContain("kc_access=;");
		expect(response.headers.get("set-cookie")).toContain("kc_refresh=;");
	});
});
