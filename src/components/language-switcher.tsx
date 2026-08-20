"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const nextLocale: Locale = locale === "zh-CN" ? "en" : "zh-CN";
  const path = pathname.replace(/^\/(zh-CN|en)/, `/${nextLocale}`);
  return <Link className="language-switcher" href={path}>{nextLocale === "en" ? "EN" : "中文"}</Link>;
}

export { locales };
