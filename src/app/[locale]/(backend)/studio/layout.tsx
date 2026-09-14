import { EmailVerificationBanner } from "@/components/email-verification-banner";

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <>
      <EmailVerificationBanner locale={locale} />
      {children}
    </>
  );
}
