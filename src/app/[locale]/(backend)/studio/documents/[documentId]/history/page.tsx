import { DocumentHistory } from "@/components/studio/document-history";

export default async function StudioDocumentHistory({ params }: { params: Promise<{ locale: string; documentId: string }> }) {
  const { locale, documentId } = await params;
  return <DocumentHistory documentId={documentId} locale={locale} />;
}
