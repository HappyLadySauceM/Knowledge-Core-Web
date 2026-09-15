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
import { getMessages } from "@/lib/i18n";

type AuthMode = "login" | "register";

function safeLoginDestination(locale: string, next?: string) {
  if (!next) return `/${locale}/studio`;
  try {
    const target = new URL(next, window.location.origin);
    const localeRoot = `/${locale}`;
    if (target.origin !== window.location.origin || (target.pathname !== localeRoot && !target.pathname.startsWith(`${localeRoot}/`))) {
      return `/${locale}/studio`;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return `/${locale}/studio`;
  }
}

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
  const t = getMessages(locale);
  const [error, setError] = useState("");
  const [problemKind, setProblemKind] = useState<AuthProblemKind | "">("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const copy = isRegister ? t.register : t.login;

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
      const mapped = messageForAuthProblem(mode, problemKeyFromBody(data), problemFallbackFromBody(data), locale);
      setProblemKind(mapped.kind);
      setError(mapped.text);
      return;
    }
    if (isRegister) {
      router.push(`/${locale}/login?registered=1`);
      return;
    }
    router.replace(safeLoginDestination(locale, next));
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
        {registered && !isRegister ? (
          <p className="form-success" role="status">
            {t.login.registered}
          </p>
        ) : null}
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
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t.common.working : isRegister ? t.auth.createAccount : t.login.submit}
          </Button>
        </form>
        <p className="auth-footnote">
          {isRegister ? (
            <>
              {t.auth.registerHint}{" "}
              <Link href={`/${locale}/login`}>{t.auth.alreadyHaveAccount}</Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/register`}>{t.auth.needAccount}</Link>{" "}
              <Link href={`/${locale}/forgot-password`}>{t.auth.forgotPassword}</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
