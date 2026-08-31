import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { maxGatewayBodyBytes } from "@/lib/bff/config";
import { copyGatewayJSON, copyGatewayResponse, refreshGateway, requestGateway, transportErrorResponse } from "@/lib/bff/gateway";
import { invalidGatewayResponse, problemResponse } from "@/lib/bff/problem";
import { contentLengthTooLarge, requireSameOrigin } from "@/lib/bff/security";
import { applySessionCookies, authenticationFromGateway, clearSessionCookies, readSession, sessionAuthentication } from "@/lib/bff/session";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJSON(request: NextRequest) {
	if (contentLengthTooLarge(request)) return null;
	const body = await request.arrayBuffer();
	if (body.byteLength === 0 || body.byteLength > maxGatewayBodyBytes) return null;
	try {
		return JSON.parse(new TextDecoder().decode(body)) as unknown;
	} catch {
		return null;
	}
}

async function readBody(request: NextRequest) {
	if (contentLengthTooLarge(request)) return null;
	const body = await request.arrayBuffer();
	return body.byteLength > maxGatewayBodyBytes ? null : body;
}

function applyResultCookies(response: NextResponse, result: Awaited<ReturnType<typeof requestGateway>>) {
	if (result.rotated) applySessionCookies(response, result.rotated);
	if (result.refreshRejected || result.secondUnauthorized) clearSessionCookies(response);
}

function invalidRequest() {
	return problemResponse(400, "Invalid request");
}

async function handleLogin(request: NextRequest) {
	const payload = await readJSON(request);
	if (!isRecord(payload) || typeof payload.identifier !== "string" || typeof payload.password !== "string") return invalidRequest();
	const result = await requestGateway(request, ["api", "v1", "sessions"], { method: "POST", body: new TextEncoder().encode(JSON.stringify(payload)).buffer, includeSession: false, retryUnauthorized: false });
	if (result.transportError) return transportErrorResponse(result.transportError);
	if (!result.response) return invalidGatewayResponse();
	if (!result.response.ok) return copyGatewayResponse(result.response);
	const data = await result.response.json().catch(() => null);
	const authentication = authenticationFromGateway(data);
	if (!authentication) return invalidGatewayResponse();
	const response = NextResponse.json(sessionAuthentication(authentication));
	applySessionCookies(response, authentication);
	return response;
}

async function handleRegister(request: NextRequest) {
	const payload = await readJSON(request);
	if (!isRecord(payload) || typeof payload.username !== "string" || typeof payload.email !== "string" || typeof payload.password !== "string") return invalidRequest();
	const result = await requestGateway(request, ["api", "v1", "users"], { method: "POST", body: new TextEncoder().encode(JSON.stringify(payload)).buffer, includeSession: false, retryUnauthorized: false });
	if (result.transportError) return transportErrorResponse(result.transportError);
	if (!result.response) return invalidGatewayResponse();
	return copyGatewayJSON(result.response);
}

async function handleSession(request: NextRequest) {
	const credentials = readSession(request);
	if (!credentials.accessToken && !credentials.refreshToken) return NextResponse.json({ user: null });

	let accessToken = credentials.accessToken;
	let refreshToken = credentials.refreshToken;
	let rotated = undefined;
	if (!accessToken && credentials.refreshToken) {
		const refreshed = await refreshGateway(request, credentials.refreshToken);
		if (refreshed.transportError) {
			const response = transportErrorResponse(refreshed.transportError);
			return response;
		}
		if (!refreshed.authentication) {
			const response = refreshed.response?.status === 401 ? NextResponse.json({ user: null }) : refreshed.response ? await copyGatewayResponse(refreshed.response) : invalidGatewayResponse();
			clearSessionCookies(response);
			return response;
		}
		accessToken = refreshed.authentication.accessToken;
		refreshToken = refreshed.authentication.refreshToken;
		rotated = refreshed.authentication;
	}

	const result = await requestGateway(request, ["api", "v1", "users", "me"], { method: "GET", accessToken, session: { accessToken, refreshToken }, retryUnauthorized: true });
	const updatedAuthentication = result.rotated ?? rotated;
	if (result.transportError) {
		const response = transportErrorResponse(result.transportError);
		if (updatedAuthentication) applySessionCookies(response, updatedAuthentication);
		return response;
	}
	if (!result.response) return invalidGatewayResponse();
	if (result.response.status === 401) {
		const response = NextResponse.json({ user: null });
		clearSessionCookies(response);
		return response;
	}
	if (!result.response.ok) {
		const response = await copyGatewayResponse(result.response);
		if (updatedAuthentication) applySessionCookies(response, updatedAuthentication);
		return response;
	}
	const user = await result.response.json().catch(() => null);
	if (!user) return invalidGatewayResponse();
	const response = NextResponse.json({ user });
	if (updatedAuthentication) applySessionCookies(response, updatedAuthentication);
	return response;
}

async function handleRefresh(request: NextRequest) {
	const refreshToken = readSession(request).refreshToken;
	if (!refreshToken) {
		const response = problemResponse(401, "Authentication required");
		clearSessionCookies(response);
		return response;
	}
	const refreshed = await refreshGateway(request, refreshToken);
	if (refreshed.transportError) {
		const response = transportErrorResponse(refreshed.transportError);
		return response;
	}
	if (!refreshed.authentication) {
		const response = refreshed.response ? await copyGatewayResponse(refreshed.response) : invalidGatewayResponse();
		clearSessionCookies(response);
		return response;
	}
	const response = NextResponse.json(sessionAuthentication(refreshed.authentication));
	applySessionCookies(response, refreshed.authentication);
	return response;
}

async function handleMapped(request: NextRequest, name: string, id?: string) {
	const routes: Record<string, { target: string[]; requestMethod: string; method: string; includeSession: boolean }> = {
		"verify-email": { target: ["api", "v1", "email-verifications"], requestMethod: "POST", method: "POST", includeSession: false },
		"request-verification": { target: ["api", "v1", "email-verification-requests"], requestMethod: "POST", method: "POST", includeSession: false },
		"request-password-reset": { target: ["api", "v1", "password-reset-requests"], requestMethod: "POST", method: "POST", includeSession: false },
		"reset-password": { target: ["api", "v1", "password-resets"], requestMethod: "POST", method: "POST", includeSession: false },
		"sessions": { target: ["api", "v1", "sessions"], requestMethod: id ? "DELETE" : "GET", method: id ? "DELETE" : "GET", includeSession: true },
		"logout-all": { target: ["api", "v1", "sessions"], requestMethod: "POST", method: "DELETE", includeSession: true },
		deactivate: { target: ["api", "v1", "users", "me", "deactivation"], requestMethod: "POST", method: "POST", includeSession: true },
	};
	const route = routes[name];
	if (!route || (id && name !== "sessions")) return problemResponse(404, "Auth route not found");
	if (request.method !== route.requestMethod) return problemResponse(405, "Method not allowed");
	const target = id ? [...route.target, id] : route.target;
	const body = ["GET", "DELETE"].includes(route.method) ? undefined : await readBody(request);
	if (!["GET", "DELETE"].includes(route.method) && !body) return invalidRequest();
	const result = await requestGateway(request, target, { method: route.method, body: body ?? undefined, session: readSession(request), includeSession: route.includeSession, retryUnauthorized: true });
	if (result.transportError) {
		const response = transportErrorResponse(result.transportError);
		if (result.rotated) applySessionCookies(response, result.rotated);
		return response;
	}
	if (!result.response) return invalidGatewayResponse();
	const response = await copyGatewayResponse(result.response);
	applyResultCookies(response, result);
	return response;
}

export async function handleAuth(request: NextRequest, path: string[]) {
	const originError = requireSameOrigin(request);
	if (originError) return originError;
	const [name, id] = path;
	if (!name || path.length > 2) return problemResponse(404, "Auth route not found");
	if (name === "login" && request.method === "POST") return handleLogin(request);
	if (name === "register" && request.method === "POST") return handleRegister(request);
	if (name === "session" && request.method === "GET") return handleSession(request);
	if (name === "refresh" && request.method === "POST") return handleRefresh(request);
	if (name === "logout" && request.method === "POST") {
		const result = await requestGateway(request, ["api", "v1", "sessions", "current"], { method: "DELETE", session: readSession(request), includeSession: true, retryUnauthorized: true });
		const response = result.transportError ? transportErrorResponse(result.transportError) : result.response?.status === 401 ? NextResponse.json({ ok: true }) : result.response ? await copyGatewayResponse(result.response) : invalidGatewayResponse();
		clearSessionCookies(response);
		return response;
	}
	return handleMapped(request, name, id);
}
