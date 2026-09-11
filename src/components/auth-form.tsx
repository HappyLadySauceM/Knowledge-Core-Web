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
import { getMessages } from "@/lib/i18n";

type AuthMode = "login" | "register";

export function AuthForm({ locale, mode, next }: { locale: string; mode: AuthMode; next?: string }) {
  const router = useRouter();
  const t = getMessages(locale);
  const [error, setError] = useState("");
  const [problemKind, setProblemKind] = useState<AuthProblemKind | "">("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const recoveryHref = verifyEmailHref(locale, submittedEmail);
  const copy = isRegister ? t.register : t.login;

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
      const mapped = messageForAuthProblem(mode, problemKeyFromBody(data), problemFallbackFromBody(data), locale);
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
        <ArrowLeft size={15} /> {t.common.back}
      </Link>
      <div className="auth-card">
        <div className="auth-icon">{isRegister ? <UserPlus size={20} /> : <KeyRound size={20} />}</div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              {t.auth.username}
              <input name="username" required minLength={3} maxLength={32} autoComplete="username" />
            </label>
          )}
          {isRegister && (
            <label>
              {t.auth.email}
              <input name="email" type="email" required autoComplete="email" />
            </label>
          )}
          {!isRegister && (
            <label>
              {t.auth.identifier}
              <input name="identifier" required autoComplete="username" />
            </label>
          )}
          <label>
            {t.auth.password}
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
              <Link href={`/${locale}/login`}>{t.auth.signIn}</Link>
              {" · "}
              <Link href={recoveryHref}>{t.auth.requestVerification}</Link>
            </p>
          ) : null}
          {problemKind === "email_not_verified" ? (
            <p className="auth-footnote">
              <Link href={recoveryHref}>{t.auth.requestVerification}</Link>
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t.common.working : isRegister ? t.auth.createAccount : t.login.submit}
          </Button>
        </form>
        <p className="auth-footnote">
          {isRegister ? (
            <>
              {t.auth.verifyHint}{" "}
              <Link href={`/${locale}/verify-email`}>{t.auth.needLink}</Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/register`}>{t.auth.needAccount}</Link>{" "}
              <Link href={`/${locale}/forgot-password`}>{t.auth.forgotPassword}</Link>{" "}
              <Link href={`/${locale}/verify-email`}>{t.auth.needVerify}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
