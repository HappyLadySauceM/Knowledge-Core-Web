import { StudioClient } from "@/components/studio/studio-client";

export default async function Studio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Block shell only: two-column layout lives on StudioClient's .studio-workspace.
  // 仅作居中外壳：两列布局由 StudioClient 的 .studio-workspace 承担。
  return <div className="studio-shell"><StudioClient locale={locale} /></div>;
}
