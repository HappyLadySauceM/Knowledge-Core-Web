import { StudioClient } from "@/components/studio/studio-client";

export default async function Studio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <div className="studio-shell container-shell"><StudioClient locale={locale} /></div>;
}
