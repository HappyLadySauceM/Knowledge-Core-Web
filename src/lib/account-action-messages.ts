import { getMessages } from "@/lib/i18n";

export type AccountAction = "verify-email" | "request-verification" | "request-password-reset" | "reset-password";

export type AccountProblemKind = "expired" | "used" | "invalid" | "generic";

// Map Gateway problem keys to page copy without echoing the raw token.
// 用 Gateway problem key 换成页面文案，不回显原始 token。
export function messageForAccountProblem(
  action: AccountAction,
  key: string | undefined,
  fallback: string,
  locale = "en",
): { kind: AccountProblemKind; text: string } {
  const t = getMessages(locale);
  if (action === "verify-email") {
    if (key === "identity.action_expired") {
      return { kind: "expired", text: t.auth.verifyExpired };
    }
    if (key === "identity.action_already_used") {
      return { kind: "used", text: t.auth.verifyUsed };
    }
    if (key === "identity.invalid_input") {
      return { kind: "invalid", text: t.auth.verifyInvalid };
    }
  }
  if (action === "reset-password") {
    if (key === "identity.action_expired") {
      return { kind: "expired", text: t.auth.resetExpired };
    }
    if (key === "identity.action_already_used") {
      return { kind: "used", text: t.auth.resetUsed };
    }
    if (key === "identity.invalid_input") {
      return { kind: "invalid", text: t.auth.resetInvalid };
    }
  }
  return { kind: "generic", text: fallback };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function problemKeyFromBody(body: unknown): string | undefined {
  if (!isRecord(body) || typeof body.key !== "string" || body.key === "") {
    return undefined;
  }
  return body.key;
}

export function problemFallbackFromBody(body: unknown): string {
  if (!isRecord(body)) {
    return "Request failed";
  }
  if (typeof body.detail === "string" && body.detail !== "") {
    return body.detail;
  }
  if (typeof body.title === "string" && body.title !== "") {
    return body.title;
  }
  return "Request failed";
}

export type AuthMode = "login" | "register";
export type AuthProblemKind = "email_conflict" | "username_conflict" | "email_not_verified" | "generic";

// Map register/login problem keys to recovery copy without leaking extra account state.
// 把注册/登录 problem key 换成可恢复文案，不额外泄露账号状态。
export function messageForAuthProblem(
  mode: AuthMode,
  key: string | undefined,
  fallback: string,
  locale = "en",
): { kind: AuthProblemKind; text: string } {
  const t = getMessages(locale);
  if (mode === "register" && key === "identity.email_conflict") {
    return { kind: "email_conflict", text: t.auth.emailConflict };
  }
  if (mode === "register" && key === "identity.username_conflict") {
    return { kind: "username_conflict", text: t.auth.usernameConflict };
  }
  if (mode === "login" && key === "identity.email_not_verified") {
    return { kind: "email_not_verified", text: t.auth.emailNotVerified };
  }
  return { kind: "generic", text: fallback };
}

export function verifyEmailHref(locale: string, email: string): string {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) {
    return `/${locale}/verify-email`;
  }
  return `/${locale}/verify-email?email=${encodeURIComponent(trimmed)}`;
}
