import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBffConfig } from "@/lib/bff/config";
import { gatewayUnavailableResponse, problemResponse } from "@/lib/bff/problem";
import { bodyTooLarge, contentLengthTooLarge, requestHeaders, responseHeaders } from "@/lib/bff/security";
import { authenticationFromGateway } from "@/lib/bff/session";
import type { SessionAuthentication, SessionCredentials } from "@/lib/bff/session";

export type GatewayTransportError = {
	timedOut: boolean;
};

export type GatewayRequestResult = {
	response?: Response;
	rotated?: SessionAuthentication;
	refreshRejected: boolean;
	secondUnauthorized: boolean;
	transportError?: GatewayTransportError;
};

function gatewayPath(segments: string[]) {
	if (segments.length < 2 || segments[0] !== "api" || segments[1] !== "v1") return null;
	return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

export function isGatewayProxyPathAllowed(segments: string[]) {
	if (segments.length < 2 || segments[0] !== "api" || segments[1] !== "v1") return false;
	const resource = segments[2];
	if (["sessions", "email-verification-requests", "email-verifications", "password-reset-requests", "password-resets"].includes(resource ?? "")) return false;
	if (resource === "users" && (segments.length === 3 || segments.slice(2).join("/") === "users/me/deactivation")) return false;
	return true;
}

function gatewayURL(request: NextRequest, path: string) {
	const config = getBffConfig();
	const url = new URL(path.slice(1), `${config.gatewayURL.toString().replace(/\/$/, "")}/`);
	url.search = request.nextUrl.search;
	return url;
}

async function fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
	const config = getBffConfig();
	const controller = new AbortController();
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, config.gatewayTimeoutMs);
	try {
		const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
		return await fetch(url, { ...init, signal });
	} catch (reason) {
		throw { timedOut: timedOut || (reason instanceof DOMException && reason.name === "TimeoutError") } satisfies GatewayTransportError;
	} finally {
		clearTimeout(timeout);
	}
}

export async function refreshGateway(request: NextRequest, refreshToken: string): Promise<{ response?: Response; authentication?: SessionAuthentication; transportError?: GatewayTransportError }> {
	const body = JSON.stringify({ refresh_token: refreshToken });
	try {
		const response = await fetchWithTimeout(new URL("api/v1/sessions/refresh", `${getBffConfig().gatewayURL.toString().replace(/\/$/, "")}/`), {
			method: "POST",
			headers: requestHeaders(request, undefined, { "content-type": "application/json" }),
			body,
		});
		if (!response.ok) return { response };
		const data = await response.clone().json().catch(() => null);
		return { response, authentication: authenticationFromGateway(data) ?? undefined };
	} catch (reason) {
		return { transportError: reason as GatewayTransportError };
	}
}

export async function requestGateway(request: NextRequest, segments: string[], options: { method?: string; body?: ArrayBuffer; accessToken?: string; session?: SessionCredentials; retryUnauthorized?: boolean; includeSession?: boolean } = {}): Promise<GatewayRequestResult> {
	const path = gatewayPath(segments);
	if (!path) return { refreshRejected: false, secondUnauthorized: false, response: problemResponse(404, "Gateway route not found") };
	if (contentLengthTooLarge(request)) return { refreshRejected: false, secondUnauthorized: false, response: problemResponse(413, "Request body too large") };
	if (options.body && bodyTooLarge(options.body)) return { refreshRejected: false, secondUnauthorized: false, response: problemResponse(413, "Request body too large") };

	const credentials = options.session ?? { accessToken: options.accessToken, refreshToken: undefined };
	const includeSession = options.includeSession ?? true;
	const method = options.method ?? request.method;
	const body = options.body;
	const makeRequest = async (accessToken?: string) => fetchWithTimeout(gatewayURL(request, path), {
		method,
		headers: requestHeaders(request, includeSession ? accessToken : undefined),
		body: method === "GET" || method === "HEAD" ? undefined : body,
	});

	let response: Response;
	try {
		response = await makeRequest(includeSession ? credentials.accessToken : undefined);
	} catch (reason) {
		return { refreshRejected: false, secondUnauthorized: false, transportError: reason as GatewayTransportError };
	}
	if (response.status !== 401 || !includeSession || options.retryUnauthorized === false || !credentials.refreshToken) {
		return { response, refreshRejected: false, secondUnauthorized: false };
	}

	const refreshed = await refreshGateway(request, credentials.refreshToken);
	if (!refreshed.authentication) {
		return { response, refreshRejected: true, secondUnauthorized: false, transportError: refreshed.transportError };
	}

	try {
		const retry = await makeRequest(refreshed.authentication.accessToken);
		return { response: retry, rotated: refreshed.authentication, refreshRejected: false, secondUnauthorized: retry.status === 401 };
	} catch (reason) {
		return { rotated: refreshed.authentication, refreshRejected: false, secondUnauthorized: false, transportError: reason as GatewayTransportError };
	}
}

export function transportErrorResponse(error: GatewayTransportError | undefined) {
	return gatewayUnavailableResponse(error?.timedOut === true);
}

export async function copyGatewayResponse(response: Response) {
	return new NextResponse(response.body, { status: response.status, headers: responseHeaders(response) });
}

export async function copyGatewayJSON(response: Response) {
	const data = await response.arrayBuffer();
	return new NextResponse(data, { status: response.status, headers: responseHeaders(response) });
}
