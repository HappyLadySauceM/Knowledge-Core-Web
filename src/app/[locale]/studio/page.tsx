import { FilePlus2, Folder, PanelLeft, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { StudioClient, StudioFolders } from "@/components/studio/studio-client";
import { AttachmentUploader } from "@/components/studio/attachment-uploader";

export default async function Studio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return <div className="studio-shell container-shell"><aside className="studio-sidebar"><div className="studio-sidebar-top"><span className="sidebar-mark">KC</span><Button variant="ghost" size="icon" aria-label={t.studio.collapse}><PanelLeft size={17} /></Button></div><div className="studio-search"><Search size={15} /><span>{t.studio.search}</span><kbd>⌘ K</kbd></div><nav className="studio-nav"><a className="selected"><Folder size={16} />{t.studio.allDocuments}</a><a><Folder size={16} />{t.studio.favorites}</a><a><Settings2 size={16} />{t.studio.settings}</a></nav><div className="studio-folders"><p>{t.studio.folders}</p><StudioFolders /></div></aside><section className="studio-content"><div className="studio-heading"><div><p className="eyebrow">{t.studio.eyebrow}</p><h1>{t.studio.title}</h1></div><Button><FilePlus2 size={16} />{t.studio.newDocument}</Button></div><AttachmentUploader /><StudioClient locale={locale} labels={{ emptyTitle: t.studio.emptyTitle, emptyBody: t.studio.emptyBody, newDocument: t.studio.newDocument, loading: "Loading documents…", failed: "Unable to load documents" }} /></section></div>;
}
