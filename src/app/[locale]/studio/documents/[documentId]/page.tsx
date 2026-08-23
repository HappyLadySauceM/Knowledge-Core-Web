import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentEditor } from "@/components/studio/document-editor";

export default async function StudioDocument({ params }: { params: Promise<{ locale: string; documentId: string }> }) {
  const { locale, documentId } = await params;
  return <main className="container-shell document-editor-page"><Link href={`/${locale}/studio`} className="article-back"><ArrowLeft size={15} />Back to studio</Link><header><p className="eyebrow">Collaborative document</p><h1>Write together.</h1><p className="document-editor-lede">Changes sync live and stay available while you reconnect.</p></header><DocumentEditor documentId={documentId} /></main>;
}
