import { AccountActionForm } from "@/components/account-action-form";

export default async function VerifyEmail() { return <div className="auth-shell container-shell"><div className="auth-card"><p className="eyebrow">Identity</p><h1>Verify your email.</h1><p>Use the token from your Knowledge Core email to activate your account.</p><AccountActionForm action="verify-email" /></div></div>; }
