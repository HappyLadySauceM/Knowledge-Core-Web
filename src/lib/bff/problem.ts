import { NextResponse } from "next/server";

export function problemResponse(status: number, title: string, detail?: string) {
	const body = {
		type: "about:blank",
		title,
		status,
		...(detail ? { detail } : {}),
	};
	return NextResponse.json(body, {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "application/problem+json",
		},
	});
}

export function gatewayUnavailableResponse(timedOut: boolean) {
	return problemResponse(timedOut ? 504 : 502, timedOut ? "Gateway request timed out" : "Gateway unavailable");
}

export function invalidGatewayResponse() {
	return problemResponse(502, "Invalid gateway response");
}
