import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return <div className="auth-shell container-shell"><Link className="back-link" href={`/${locale}`}><ArrowLeft size={15} /> {t.common.back}</Link><div className="auth-card"><div className="auth-icon"><KeyRound size={20} /></div><p className="eyebrow">{t.login.eyebrow}</p><h1>{t.login.title}</h1><p>{t.login.body}</p><form className="auth-form"><label>{t.login.email}<input type="email" placeholder="you@example.com" /></label><label>{t.login.password}<input type="password" placeholder="••••••••" /></label><Button type="button" size="lg">{t.login.submit}</Button></form><p className="auth-footnote">{t.login.footnote}</p></div></div>;
}
