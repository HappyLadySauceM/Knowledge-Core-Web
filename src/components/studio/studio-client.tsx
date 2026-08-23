"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { DocumentPage, Folder, FolderList } from "@/lib/api/types";

export function StudioFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  useEffect(() => { apiFetch<FolderList>("/api/v1/studio/folders").then((value) => setFolders(value.items)).catch(() => undefined); }, []);
  return <>{folders.map((folder) => <a key={folder.id} href={`#folder-${folder.id}`}><span aria-hidden="true">▱</span>{folder.name}</a>)}</>;
}

export function StudioClient({ locale, labels }: { locale: string; labels: { emptyTitle: string; emptyBody: string; newDocument: string; loading: string; failed: string } }) {
  const [page, setPage] = useState<DocumentPage | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    apiFetch<DocumentPage>("/api/v1/studio/documents?limit=50")
      .then((value) => { if (active) setPage(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (!page && !error) return <div className="studio-loading"><LoaderCircle className="spin" size={22} />{labels.loading}</div>;
  if (error) return <div className="studio-empty"><h2>{labels.failed}</h2><p>{labels.emptyBody}</p></div>;
  if (!page?.items.length) return <div className="studio-empty"><div className="empty-orbit"><span /><span /><span /></div><h2>{labels.emptyTitle}</h2><p>{labels.emptyBody}</p><Button variant="secondary"><FilePlus2 size={16} />{labels.newDocument}</Button></div>;
  return <div className="studio-document-list">{page.items.map((document) => <Link key={document.id} href={`/${locale}/studio/documents/${document.id}`} className="studio-document-row"><div><p>{document.tags?.[0] ?? (document.published ? "Published" : "Draft")}</p><h2>{document.title}</h2><span>{document.summary || "No summary yet"}</span></div><time dateTime={document.updated_at}>{new Date(document.updated_at).toLocaleDateString()}</time></Link>)}</div>;
}
