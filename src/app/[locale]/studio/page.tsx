import { getMessages } from "@/lib/i18n";
import { StudioClient } from "@/components/studio/studio-client";

export default async function Studio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return <div className="studio-shell container-shell"><StudioClient locale={locale} labels={{ emptyTitle: t.studio.emptyTitle, emptyBody: t.studio.emptyBody, newDocument: t.studio.newDocument, loading: locale === "zh-CN" ? "正在加载文档…" : "Loading documents…", failed: locale === "zh-CN" ? "无法加载文档" : "Unable to load documents" }} /></div>;
}
