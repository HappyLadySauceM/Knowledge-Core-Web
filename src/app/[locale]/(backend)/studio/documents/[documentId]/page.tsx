import { DocumentEditor } from "@/components/studio/document-editor";

export default async function StudioDocument({ params }: { params: Promise<{ locale: string; documentId: string }> }) {
  const { locale, documentId } = await params;
  return <div className="document-editor-page"><DocumentEditor documentId={documentId} locale={locale} /></div>;
}
