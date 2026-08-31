import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
	accessCookieName,
	refreshCookieMaxAge,
	refreshCookieName,
	BffConfig,
	getBffConfig,
} from "@/lib/bff/config";

export type SessionCredentials = {
	accessToken?: string;
	refreshToken?: string;
};

export type SessionAuthentication = {
	user: unknown;
	expiresAt: string;
	accessToken: string;
	refreshToken: string;
};

export function readSession(request: NextRequest): SessionCredentials {
	return {
		accessToken: request.cookies.get(accessCookieName)?.value,
		refreshToken: request.cookies.get(refreshCookieName)?.value,
	};
}

export function applySessionCookies(response: NextResponse, authentication: Pick<SessionAuthentication, "accessToken" | "refreshToken" | "expiresAt">, config: BffConfig = getBffConfig()) {
	const expiresAt = Date.parse(authentication.expiresAt);
	const maxAge = Number.isFinite(expiresAt) ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 15 * 60;
	response.cookies.set(accessCookieName, authentication.accessToken, {
		httpOnly: true,
		secure: config.secureCookies,
		sameSite: "lax",
		path: "/",
		maxAge,
		...(Number.isFinite(expiresAt) ? { expires: new Date(expiresAt) } : {}),
	});
	response.cookies.set(refreshCookieName, authentication.refreshToken, {
		httpOnly: true,
		secure: config.secureCookies,
		sameSite: "strict",
		path: "/",
		maxAge: refreshCookieMaxAge,
	});
}

export function clearSessionCookies(response: NextResponse, config: BffConfig = getBffConfig()) {
	for (const name of [accessCookieName, refreshCookieName]) {
		response.cookies.set(name, "", {
			httpOnly: true,
			secure: config.secureCookies,
			sameSite: name === accessCookieName ? "lax" : "strict",
			path: "/",
			maxAge: 0,
			expires: new Date(0),
		});
	}
}

export function isAuthentication(value: unknown): value is SessionAuthentication {
	if (!value || typeof value !== "object") return false;
	const data = value as Record<string, unknown>;
	const expiresAt = typeof data.expires_at === "string" ? Date.parse(data.expires_at) : Number.NaN;
	return typeof data.access_token === "string" && data.access_token.length > 0 && typeof data.refresh_token === "string" && data.refresh_token.length > 0 && Number.isFinite(expiresAt) && expiresAt > Date.now() && "user" in data;
}

export function sessionAuthentication(value: SessionAuthentication) {
	return { user: value.user, expires_at: value.expiresAt };
}

export function authenticationFromGateway(value: unknown): SessionAuthentication | null {
	if (!isAuthentication(value)) return null;
	const data = value as Record<string, unknown>;
	return {
		user: data.user,
		expiresAt: data.expires_at as string,
		accessToken: data.access_token as string,
		refreshToken: data.refresh_token as string,
	};
}
