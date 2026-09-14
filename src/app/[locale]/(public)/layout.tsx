import { SiteHeader } from "@/components/site-header";
import { getSiteProfile } from "@/lib/site";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, profile] = await Promise.all([params, getSiteProfile()]);
  return (
    <>
      <SiteHeader locale={locale} profile={profile} />
      <main>{children}</main>
    </>
  );
}
