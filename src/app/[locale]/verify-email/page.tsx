import { AccountActionForm } from "@/components/account-action-form";

export default async function VerifyEmail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const [{ locale }, { token, email }] = await Promise.all([params, searchParams]);
  const hasToken = Boolean(token?.trim());
  return (
    <div className="auth-shell container-shell">
      <div className="auth-card">
        <p className="eyebrow">Identity</p>
        <h1>Verify your email.</h1>
        <p>
          {hasToken
            ? "We are confirming the link from your Knowledge Core email."
            : "Open the link in your Knowledge Core email, or enter your address to request a new one."}
        </p>
        <AccountActionForm key={token ?? email ?? "verify-email"} action="verify-email" locale={locale} token={token} email={email} />
      </div>
    </div>
  );
}
