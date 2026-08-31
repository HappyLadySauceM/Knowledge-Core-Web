import type { NextRequest } from "next/server";
import { copyGatewayResponse, isGatewayProxyPathAllowed, requestGateway, transportErrorResponse } from "@/lib/bff/gateway";
import { problemResponse } from "@/lib/bff/problem";
import { contentLengthTooLarge, requireSameOrigin } from "@/lib/bff/security";
import { applySessionCookies, clearSessionCookies, readSession } from "@/lib/bff/session";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	try {
		const originError = requireSameOrigin(request);
		if (originError) return originError;
		const path = (await context.params).path;
		if (!isGatewayProxyPathAllowed(path)) return problemResponse(404, "Gateway route not found");
		if (contentLengthTooLarge(request)) return problemResponse(413, "Request body too large");
		const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
		const result = await requestGateway(request, path, { body, session: readSession(request), retryUnauthorized: true });
		if (result.transportError) {
			const response = transportErrorResponse(result.transportError);
			if (result.rotated) applySessionCookies(response, result.rotated);
			return response;
		}
		if (!result.response) return problemResponse(502, "Invalid gateway response");
		const response = await copyGatewayResponse(result.response);
		if (result.rotated) applySessionCookies(response, result.rotated);
		if (result.refreshRejected || result.secondUnauthorized) clearSessionCookies(response);
		return response;
	} catch {
		return problemResponse(500, "BFF unavailable");
	}
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}
