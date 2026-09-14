"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { SessionDataSchema, type SiteProfile } from "@/lib/api/types";

export function SiteHeader({ locale, profile }: { locale: string; profile?: SiteProfile }) {
  const t = getMessages(locale);
  const router = useRouter();
  const session = useQuery({ queryKey: ["session"], queryFn: async () => { const response = await fetch("/api/bff/auth/session"); if (!response.ok) throw new Error("session unavailable"); return SessionDataSchema.parse(await response.json()); }, retry: false });
  async function logout() { await fetch("/api/bff/auth/logout", { method: "POST" }); router.push(`/${locale}`); router.refresh(); }
  const user = session.data?.user;
  return <header className="site-header"><div className="site-header-inner container-shell"><Link href={`/${locale}`} className="brand"><span className="brand-mark">HS</span><span>{profile?.title ?? "HappyLadySauce"}</span></Link><nav className="site-nav"><Link href={`/${locale}`}>{t.nav.explore}</Link><Link href={`/${locale}/studio`}>{t.nav.studio}</Link>{user && <Link href={`/${locale}/studio/media`}>{t.nav.media}</Link>}{user?.role === "admin" && <Link href={`/${locale}/admin`}>{t.nav.admin}</Link>}</nav><div className="header-actions"><LanguageSwitcher locale={locale} /><ThemeToggle />{user ? <div className="account-actions"><Link href={`/${locale}/settings/security`}>{user.username}</Link><button type="button" onClick={() => void logout()}>{t.nav.signOut}</button></div> : <Button asChild size="sm"><Link href={`/${locale}/login`}>{t.nav.signIn}</Link></Button>}</div></div></header>;
}
