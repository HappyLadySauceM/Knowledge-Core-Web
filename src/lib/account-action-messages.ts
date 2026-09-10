export type AccountAction = "verify-email" | "request-verification" | "request-password-reset" | "reset-password";

export type AccountProblemKind = "expired" | "used" | "invalid" | "generic";

// Map Gateway problem keys to page copy without echoing the raw token.
// 用 Gateway problem key 换成页面文案，不回显原始 token。
export function messageForAccountProblem(action: AccountAction, key: string | undefined, fallback: string): { kind: AccountProblemKind; text: string } {
  if (action === "verify-email") {
    if (key === "identity.action_expired") {
      return { kind: "expired", text: "This verification link has expired. Enter your email to request a new one." };
    }
    if (key === "identity.action_already_used") {
      return { kind: "used", text: "This email is already verified. You can sign in." };
    }
    if (key === "identity.invalid_input") {
      return { kind: "invalid", text: "This verification link is invalid. Enter your email to request a new one." };
    }
  }
  if (action === "reset-password") {
    if (key === "identity.action_expired") {
      return { kind: "expired", text: "This reset link has expired. Request a new password reset email." };
    }
    if (key === "identity.action_already_used") {
      return { kind: "used", text: "This reset link has already been used. Sign in or request a new reset email." };
    }
    if (key === "identity.invalid_input") {
      return { kind: "invalid", text: "This reset link is invalid. Request a new password reset email." };
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
