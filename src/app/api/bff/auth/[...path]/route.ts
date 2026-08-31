import type { NextRequest } from "next/server";
import { handleAuth } from "@/lib/bff/auth";
import { problemResponse } from "@/lib/bff/problem";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	try {
		return await handleAuth(request, (await context.params).path);
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
	return handle(request, context);
}
