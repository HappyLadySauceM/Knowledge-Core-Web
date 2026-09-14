import { AccountActionForm } from "@/components/account-action-form";
import { getMessages } from "@/lib/i18n";

export default async function ResetPassword({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  const t = getMessages(locale);
  const hasToken = Boolean(token?.trim());
  return (
    <div className="auth-shell container-shell">
      <div className="auth-card">
        <p className="eyebrow">{t.resetPassword.eyebrow}</p>
        <h1>{t.resetPassword.title}</h1>
        <p>{hasToken ? t.resetPassword.bodyWithToken : t.resetPassword.bodyWithoutToken}</p>
        <AccountActionForm action="reset-password" locale={locale} token={token} />
      </div>
    </div>
  );
}
