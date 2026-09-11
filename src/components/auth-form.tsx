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
} from "@/lib/account-action-messages";

type AuthMode = "login" | "register";

export function AuthForm({
  locale,
  mode,
  next,
  registered = false,
}: {
  locale: string;
  mode: AuthMode;
  next?: string;
  registered?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [problemKind, setProblemKind] = useState<AuthProblemKind | "">("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setProblemKind("");
    const form = new FormData(event.currentTarget);
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
      return;
    }
    if (isRegister) {
      router.push(`/${locale}/login?registered=1`);
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
        {registered && !isRegister ? (
          <p className="form-success" role="status">
            Account created. Sign in, then verify your email from Studio.
          </p>
        ) : null}
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
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Working…" : isRegister ? "Create account" : "Continue"}
          </Button>
        </form>
        <p className="auth-footnote">
          {isRegister ? (
            <>
              After you create an account, sign in. Studio will remind you to verify your email.{" "}
              <Link href={`/${locale}/login`}>Already have an account?</Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/register`}>Need an account? Create one.</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
