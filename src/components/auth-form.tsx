"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AuthProblemKind,
  messageForAuthProblem,
  problemFallbackFromBody,
  problemKeyFromBody,
  verifyEmailHref,
} from "@/lib/account-action-messages";

type AuthMode = "login" | "register";

export function AuthForm({ locale, mode, next }: { locale: string; mode: AuthMode; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [problemKind, setProblemKind] = useState<AuthProblemKind | "">("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const recoveryHref = verifyEmailHref(locale, submittedEmail);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setProblemKind("");
    const form = new FormData(event.currentTarget);
    const email = String((isRegister ? form.get("email") : form.get("identifier")) ?? "");
    const payload = isRegister
      ? { username: form.get("username"), email: form.get("email"), password: form.get("password") }
      : { identifier: form.get("identifier"), password: form.get("password") };
    const response = await fetch(`/api/bff/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: unknown = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      const mapped = messageForAuthProblem(mode, problemKeyFromBody(data), problemFallbackFromBody(data));
      setProblemKind(mapped.kind);
      setError(mapped.text);
      setSubmittedEmail(email);
      return;
    }
    if (isRegister) {
      router.push(`/${locale}/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }
    router.push(next?.startsWith(`/${locale}/`) ? next : `/${locale}/studio`);
    router.refresh();
  }

  return (
    <div className="auth-shell container-shell">
      <Link className="back-link" href={`/${locale}`}>
        <ArrowLeft size={15} /> Back
      </Link>
      <div className="auth-card">
        <div className="auth-icon">{isRegister ? <UserPlus size={20} /> : <KeyRound size={20} />}</div>
        <p className="eyebrow">{isRegister ? "Create your workspace" : "Welcome back"}</p>
        <h1>{isRegister ? "Start your core." : "Sign in to your core."}</h1>
        <p>
          {isRegister
            ? "A focused space for writing, learning, and sharing."
            : "Your workspace is waiting exactly where you left it."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              Username
              <input name="username" required minLength={3} maxLength={32} autoComplete="username" />
            </label>
          )}
          {isRegister && (
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
          )}
          {!isRegister && (
            <label>
              Email or username
              <input name="identifier" required autoComplete="username" />
            </label>
          )}
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {problemKind === "email_conflict" ? (
            <p className="auth-footnote">
              <Link href={`/${locale}/login`}>Sign in</Link>
              {" · "}
              <Link href={recoveryHref}>Request a new verification link</Link>
            </p>
          ) : null}
          {problemKind === "email_not_verified" ? (
            <p className="auth-footnote">
              <Link href={recoveryHref}>Request a new verification link</Link>
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Working…" : isRegister ? "Create account" : "Continue"}
          </Button>
        </form>
        <p className="auth-footnote">
          {isRegister ? (
            <>
              Verify your email before signing in.{" "}
              <Link href={`/${locale}/verify-email`}>Need a new link?</Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/register`}>Need an account? Create one.</Link>{" "}
              <Link href={`/${locale}/verify-email`}>Need to verify your email?</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
