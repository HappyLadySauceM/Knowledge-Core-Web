import type { NextRequest } from "next/server";
import { getBffConfig, maxGatewayBodyBytes } from "@/lib/bff/config";
import { problemResponse } from "@/lib/bff/problem";

const forwardedRequestHeaders = [
	"accept",
	"accept-language",
	"content-type",
	"if-match",
	"idempotency-key",
	"traceparent",
	"tracestate",
	"x-request-id",
] as const;

const forwardedResponseHeaders = [
	"cache-control",
	"content-disposition",
	"content-type",
	"etag",
	"location",
	"retry-after",
	"vary",
	"www-authenticate",
	"x-request-id",
	"x-trace-id",
] as const;

export function requireSameOrigin(request: NextRequest, method = request.method) {
	if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;
	const expected = getBffConfig().webOrigin;
	const origin = request.headers.get("origin");
	if (!origin || origin !== expected.origin) return problemResponse(403, "Invalid origin");
	return null;
}

export function requestHeaders(request: NextRequest, accessToken?: string, overrides?: HeadersInit) {
	const headers = new Headers();
	for (const name of forwardedRequestHeaders) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
	if (overrides) {
		const extra = new Headers(overrides);
		extra.forEach((value, name) => headers.set(name, value));
	}
	return headers;
}

export function responseHeaders(response: Response) {
	const headers = new Headers();
	for (const name of forwardedResponseHeaders) {
		const value = response.headers.get(name);
		if (value) headers.set(name, value);
	}
	return headers;
}

export function contentLengthTooLarge(request: NextRequest) {
	const value = request.headers.get("content-length");
	if (!value) return false;
	const length = Number(value);
	return Number.isFinite(length) && length > maxGatewayBodyBytes;
}

export function bodyTooLarge(body: ArrayBuffer) {
	return body.byteLength > maxGatewayBodyBytes;
}
