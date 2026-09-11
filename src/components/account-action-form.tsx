"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type AccountAction,
  type AccountProblemKind,
  messageForAccountProblem,
  problemFallbackFromBody,
  problemKeyFromBody,
} from "@/lib/account-action-messages";

type ActionResult = {
  ok: boolean;
  complete: boolean;
  kind: AccountProblemKind | "";
  error: string;
  message: string;
};

// POST an account action and map Gateway problem keys to page copy.
// 提交账号动作，并把 Gateway problem key 映射成页面文案。
async function postAccountAction(target: AccountAction, payload: Record<string, string>): Promise<ActionResult> {
  const response = await fetch(`/api/bff/auth/${target}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const mapped = messageForAccountProblem(target, problemKeyFromBody(data), problemFallbackFromBody(data));
    return { ok: false, complete: false, kind: mapped.kind, error: mapped.text, message: "" };
  }
  const complete = target === "verify-email" || target === "reset-password";
  return {
    ok: true,
    complete,
    kind: "",
    error: "",
    message: complete ? "Your request is complete." : "Request accepted. Check your email to continue.",
  };
}

const verifyEmailInflight = new Map<string, Promise<ActionResult>>();

// Reuse an in-flight verify POST so React Strict Mode remounts do not consume twice.
// 复用进行中的验证请求，避免 React Strict Mode 二次挂载把令牌消费两次。
function verifyEmailOnce(token: string): Promise<ActionResult> {
  const existing = verifyEmailInflight.get(token);
  if (existing) {
    return existing;
  }
  const request = postAccountAction("verify-email", { token }).finally(() => {
    verifyEmailInflight.delete(token);
  });
  verifyEmailInflight.set(token, request);
  return request;
}

export function AccountActionForm({
  action,
  locale = "zh-CN",
  email = "",
  token = "",
}: {
  action: AccountAction;
  locale?: string;
  email?: string;
  token?: string;
}) {
  const trimmedToken = token.trim();
  const verification = action === "verify-email";
  const reset = action === "reset-password";
  const requestReset = action === "request-password-reset";
  const requestVerification = action === "request-verification";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [problemKind, setProblemKind] = useState<AccountProblemKind | "">("");
  const [pending, setPending] = useState(verification && Boolean(trimmedToken));
  const [complete, setComplete] = useState(false);

  function applyResult(result: ActionResult) {
    setPending(false);
    setComplete(result.complete);
    setProblemKind(result.kind);
    setError(result.error);
    setMessage(result.message);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      payload[key] = String(value);
    }
    const target = (event.currentTarget.dataset.action as AccountAction | undefined) ?? action;
    setPending(true);
    setMessage("");
    setError("");
    if (target === action) {
      setProblemKind("");
    }
    applyResult(await postAccountAction(target, payload));
  }

  useEffect(() => {
    if (!verification || !trimmedToken) {
      return;
    }
    let cancelled = false;
    void verifyEmailOnce(trimmedToken).then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trimmedToken, verification]);

  const showForgotPassword = reset && (problemKind === "expired" || problemKind === "invalid" || problemKind === "used");
  const showSignIn =
    (verification && (!trimmedToken || complete || problemKind === "used" || problemKind === "expired" || problemKind === "invalid")) ||
    (reset && (complete || problemKind === "used"));
  const verifying = verification && Boolean(trimmedToken) && pending && !error && !message;
  const hideVerifyForm = verification && (!trimmedToken || complete || problemKind === "used" || problemKind === "expired" || problemKind === "invalid" || verifying);

  if (verification && hideVerifyForm) {
    return (
      <div className="auth-form">
        {trimmedToken ? <input type="hidden" name="token" value={trimmedToken} /> : null}
        {verifying ? <p className="form-success" role="status">Verifying…</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="form-success" role="status">{message}</p> : null}
        {showSignIn ? (
          <p className="auth-footnote">
            <Link href={`/${locale}/login`}>Continue to sign in</Link>
          </p>
        ) : null}
      </div>
    );
  }

  if (reset && !trimmedToken) {
    return (
      <div className="auth-form">
        <p className="form-error" role="alert">
          Open the reset link from your email, or request a new one.
        </p>
        <p className="auth-footnote">
          <Link href={`/${locale}/forgot-password`}>Request a password reset</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {(requestVerification || requestReset) && (
        <label>
          {requestReset ? "Email or username" : "Email"}
          <input
            name={requestReset ? "identifier" : "email"}
            type={requestReset ? "text" : "email"}
            defaultValue={email}
            required
            autoComplete={requestReset ? "username" : "email"}
          />
        </label>
      )}
      {(verification || reset) && trimmedToken ? <input type="hidden" name="token" value={trimmedToken} /> : null}
      {reset && trimmedToken ? (
        <label>
          New password
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {showSignIn ? (
        <p className="auth-footnote">
          <Link href={`/${locale}/login`}>Continue to sign in</Link>
        </p>
      ) : null}
      {showForgotPassword ? (
        <p className="auth-footnote">
          <Link href={`/${locale}/forgot-password`}>Request a new reset email</Link>
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Working…" : verification ? "Verify email" : reset ? "Set new password" : "Continue"}
      </Button>
    </form>
  );
}
