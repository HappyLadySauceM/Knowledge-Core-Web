import { AccountActionForm } from "@/components/account-action-form";

export default async function ResetPassword({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  const hasToken = Boolean(token?.trim());
  return (
    <div className="auth-shell container-shell">
      <div className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password.</h1>
        <p>
          {hasToken
            ? "Choose a new password to finish recovering your account."
            : "Open the one-time link from your recovery email to continue."}
        </p>
        <AccountActionForm action="reset-password" locale={locale} token={token} />
      </div>
    </div>
  );
}
