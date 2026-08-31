const defaultGatewayURL = "http://localhost:8080";
const defaultWebOrigin = "http://localhost:3000";
const defaultGatewayTimeoutMs = 30_000;

export const maxGatewayBodyBytes = 4 * 1024 * 1024;
export const accessCookieName = "kc_access";
export const refreshCookieName = "kc_refresh";
export const refreshCookieMaxAge = 30 * 24 * 60 * 60;

export type BffConfig = {
	gatewayURL: URL;
	webOrigin: URL;
	gatewayTimeoutMs: number;
	secureCookies: boolean;
};

function parseOrigin(value: string, name: string) {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(`${name} must be an absolute HTTP(S) URL`);
	}
	if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
		throw new Error(`${name} must be an HTTP(S) origin without credentials or a path`);
	}
	return parsed;
}

function parseTimeout(value: string | undefined) {
	if (value === undefined || value.trim() === "") return defaultGatewayTimeoutMs;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
		throw new Error("KNOWLEDGE_CORE_GATEWAY_TIMEOUT_MS must be an integer between 1000 and 60000");
	}
	return parsed;
}

export function getBffConfig(): BffConfig {
	const gatewayURL = parseOrigin(process.env.KNOWLEDGE_CORE_GATEWAY_URL ?? defaultGatewayURL, "KNOWLEDGE_CORE_GATEWAY_URL");
	const webOrigin = parseOrigin(process.env.KNOWLEDGE_CORE_WEB_ORIGIN ?? defaultWebOrigin, "KNOWLEDGE_CORE_WEB_ORIGIN");
	return {
		gatewayURL,
		webOrigin,
		gatewayTimeoutMs: parseTimeout(process.env.KNOWLEDGE_CORE_GATEWAY_TIMEOUT_MS),
		secureCookies: webOrigin.protocol === "https:",
	};
}
