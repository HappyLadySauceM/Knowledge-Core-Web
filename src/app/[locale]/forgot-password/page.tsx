import { AccountActionForm } from "@/components/account-action-form";

export default async function ForgotPassword() { return <div className="auth-shell container-shell"><div className="auth-card"><p className="eyebrow">Account recovery</p><h1>Reset your password.</h1><p>We will send a one-time link if the account exists.</p><AccountActionForm action="request-password-reset" /></div></div>; }
