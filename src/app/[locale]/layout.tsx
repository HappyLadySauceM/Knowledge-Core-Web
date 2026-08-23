import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { isLocale, locales } from "@/lib/i18n";
import { getSiteProfile } from "@/lib/site";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const profile = await getSiteProfile();
  return { title: profile.title, description: locale === "zh-CN" ? profile.tagline_zh : profile.tagline_en };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await getSiteProfile();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SiteHeader locale={locale} profile={profile} />
      <main>{children}</main>
    </ThemeProvider>
  );
}
