import { AccountActionForm } from "@/components/account-action-form";
import { getMessages } from "@/lib/i18n";

export default async function VerifyEmail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const [{ locale }, { token, email }] = await Promise.all([params, searchParams]);
  const t = getMessages(locale);
  const hasToken = Boolean(token?.trim());
  return (
    <div className="auth-shell container-shell">
      <div className="auth-card">
        <p className="eyebrow">{t.verifyEmail.eyebrow}</p>
        <h1>{t.verifyEmail.title}</h1>
        <p>{hasToken ? t.verifyEmail.bodyWithToken : t.verifyEmail.bodyWithoutToken}</p>
        <AccountActionForm key={token ?? email ?? "verify-email"} action="verify-email" locale={locale} token={token} email={email} />
      </div>
    </div>
  );
}
