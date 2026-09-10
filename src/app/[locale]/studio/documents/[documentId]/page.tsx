import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentEditor } from "@/components/studio/document-editor";

export default async function StudioDocument({ params }: { params: Promise<{ locale: string; documentId: string }> }) {
  const { locale, documentId } = await params;
  return <main className="container-shell document-editor-page"><Link href={`/${locale}/studio`} className="article-back"><ArrowLeft size={15} />{locale === "zh-CN" ? "返回工作区" : "Back to studio"}</Link><DocumentEditor documentId={documentId} locale={locale} /></main>;
}
