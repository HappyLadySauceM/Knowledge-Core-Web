import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import type { SiteProfile } from "@/lib/api/types";

export function SiteHeader({ locale, profile }: { locale: string; profile?: SiteProfile }) {
  const t = getMessages(locale);
  return <header className="site-header"><div className="site-header-inner container-shell"><Link href={`/${locale}`} className="brand"><span className="brand-mark">HS</span><span>{profile?.title ?? "HappyLadySauce"}</span></Link><nav className="site-nav"><Link href={`/${locale}`}>{t.nav.explore}</Link><Link href={`/${locale}/studio`}>{t.nav.studio}</Link><Link href={`/${locale}#principles`}>{t.nav.principles}</Link></nav><div className="header-actions"><LanguageSwitcher locale={locale} /><ThemeToggle /><Button asChild size="sm"><Link href={`/${locale}/login`}>{t.nav.signIn}</Link></Button></div></div></header>;
}
