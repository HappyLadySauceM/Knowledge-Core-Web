import { AccountActionForm } from "@/components/account-action-form";

export default async function ResetPassword() { return <div className="auth-shell container-shell"><div className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a new password.</h1><p>Use the one-time token from your recovery email.</p><AccountActionForm action="reset-password" /></div></div>; }
