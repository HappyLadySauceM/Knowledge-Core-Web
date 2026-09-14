import { Suspense } from "react";
import { BackendShell } from "@/components/studio/backend-shell";
import { getSiteProfile } from "@/lib/site";

export default async function BackendLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, profile] = await Promise.all([params, getSiteProfile()]);
  return <Suspense fallback={<div className="backend-shell-loading" aria-hidden="true" />}><BackendShell locale={locale} profile={profile}>{children}</BackendShell></Suspense>;
}
