import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app-providers";
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

  // Locale layout owns <html lang> so SSR matches /zh-CN vs /en.
  // 由 locale layout 设置 <html lang>，让服务端渲染与 /zh-CN、/en 一致。
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppProviders>
            <SiteHeader locale={locale} profile={profile} />
            <main>{children}</main>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
