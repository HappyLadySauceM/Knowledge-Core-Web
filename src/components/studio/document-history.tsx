"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { documentsApi } from "@/lib/api/documents";
import { type RichTextNode } from "@/lib/api/types";
import { RichText } from "@/components/rich-text";
import { getMessages } from "@/lib/i18n";

export function DocumentHistory({ documentId, locale }: { documentId: string; locale: string }) {
  const t = getMessages(locale);
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const commits = useQuery({ queryKey: ["commits", documentId], queryFn: () => documentsApi.commits.list(documentId).then((value) => value.data) });
  const detail = useQuery({ queryKey: ["commit", documentId, selected], queryFn: () => documentsApi.commits.get(documentId, selected!).then((value) => value.data), enabled: Boolean(selected) });
  const current = detail.data ?? commits.data?.items.find((item) => item.id === selected);
  const content = (current?.content.content ?? []) as RichTextNode[];
  return <main className="document-history-page">
    <header className="document-history-header">
      <button type="button" onClick={() => router.push(`/${locale}/studio/documents/${documentId}`)}><ArrowLeft size={15} />{t.editor.backToEditor}</button>
      <h1>{t.editor.history}</h1>
      {current ? <button type="button" className="editor-publish-button" onClick={() => router.push(`/${locale}/studio/documents/${documentId}?restore=${encodeURIComponent(current.id)}`)}><RotateCcw size={14} />{t.editor.restoreCommit}</button> : null}
    </header>
    <div className="document-history-layout">
      <section className="document-history-preview">{current ? <><p className="eyebrow">{current.label} · {new Date(current.created_at).toLocaleString(locale)}</p><RichText content={content} /></> : <p>{t.editor.selectHistory}</p>}</section>
      <aside className="document-history-timeline" aria-label={t.editor.history}>
        {commits.data?.items.map((commit) => <button type="button" className={commit.id === selected ? "is-selected" : ""} key={commit.id} onClick={() => setSelected(commit.id)}><strong>{commit.label}</strong><span>{commit.kind} · {new Date(commit.created_at).toLocaleString(locale)}</span><small>{commit.contributor}</small></button>)}
      </aside>
    </div>
  </main>;
}
