"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

type Action = "verify-email" | "request-verification" | "request-password-reset" | "reset-password";
export function AccountActionForm({ action, email = "", token = "" }: { action: Action; email?: string; token?: string }) {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setMessage(""); setError(""); const values = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); const data = await response.json().catch(() => ({})); setPending(false); if (!response.ok) setError(data.detail ?? data.title ?? "Request failed"); else setMessage(action === "verify-email" || action === "reset-password" ? "Your request is complete." : "Request accepted. Check your email to continue."); }
  const verification = action === "verify-email"; const reset = action === "reset-password"; const requestReset = action === "request-password-reset";
  return <form className="auth-form" onSubmit={submit}>{(action === "request-verification" || requestReset) && <label>{requestReset ? "Email or username" : "Email"}<input name={requestReset ? "identifier" : "email"} type={requestReset ? "text" : "email"} defaultValue={email} required /></label>}{(verification || reset) && <label>Token<input name="token" required autoComplete="one-time-code" defaultValue={token} /></label>}{reset && <label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<Button type="submit" size="lg" disabled={pending}>{pending ? "Working…" : verification ? "Verify email" : reset ? "Set new password" : "Continue"}</Button></form>;
}
