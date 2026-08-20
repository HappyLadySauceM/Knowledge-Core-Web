import { FilePlus2, Folder, PanelLeft, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default async function Studio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getMessages(locale);
  return <div className="studio-shell container-shell"><aside className="studio-sidebar"><div className="studio-sidebar-top"><span className="sidebar-mark">KC</span><Button variant="ghost" size="icon" aria-label={t.studio.collapse}><PanelLeft size={17} /></Button></div><div className="studio-search"><Search size={15} /><span>{t.studio.search}</span><kbd>⌘ K</kbd></div><nav className="studio-nav"><a className="selected"><Folder size={16} />{t.studio.allDocuments}<span>12</span></a><a><Folder size={16} />{t.studio.favorites}</a><a><Settings2 size={16} />{t.studio.settings}</a></nav><div className="studio-folders"><p>{t.studio.folders}</p><a><Folder size={15} /> Research</a><a><Folder size={15} /> Essays</a></div></aside><section className="studio-content"><div className="studio-heading"><div><p className="eyebrow">{t.studio.eyebrow}</p><h1>{t.studio.title}</h1></div><Button><FilePlus2 size={16} />{t.studio.newDocument}</Button></div><div className="studio-empty"><div className="empty-orbit"><span /><span /><span /></div><h2>{t.studio.emptyTitle}</h2><p>{t.studio.emptyBody}</p><Button variant="secondary"><FilePlus2 size={16} />{t.studio.newDocument}</Button></div></section></div>;
}
