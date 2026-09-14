import { AccountActionForm } from "@/components/account-action-form";
import { getMessages } from "@/lib/i18n";

export default async function ForgotPassword({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return (
    <div className="auth-shell container-shell">
      <div className="auth-card">
        <p className="eyebrow">{t.forgotPassword.eyebrow}</p>
        <h1>{t.forgotPassword.title}</h1>
        <p>{t.forgotPassword.body}</p>
        <AccountActionForm action="request-password-reset" locale={locale} />
      </div>
    </div>
  );
}
