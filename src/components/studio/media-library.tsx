"use client";
/* eslint-disable @next/next/no-img-element -- authenticated media URLs resolve through a short-lived 303 redirect. */

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, RotateCcw, Trash2 } from "lucide-react";
import { AttachmentUploader } from "@/components/studio/attachment-uploader";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/dialog";
import { mediaApi } from "@/lib/api/media";
import type { MediaAttachment } from "@/lib/api/types";
import { getMessages } from "@/lib/i18n";

export function MediaLibrary({ locale }: { locale: string }) {
  const t = getMessages(locale);
  const client = useQueryClient();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [pendingTrash, setPendingTrash] = useState<MediaAttachment | null>(null);
  const media = useQuery({ queryKey: ["media", category, status, cursor], queryFn: () => mediaApi.list({ category, status, cursor, limit: 50 }).then((value) => value.data) });
  const mutate = useMutation({ mutationFn: async ({ id, restore }: { id: string; restore: boolean }) => { if (restore) await mediaApi.restore(id); else await mediaApi.remove(id); }, onSuccess: () => client.invalidateQueries({ queryKey: ["media"] }) });
  const empty = !media.isLoading && !media.error && (media.data?.items.length ?? 0) === 0;
  return <section className="management-page">
    <Link className="back-link-static" href={`/${locale}/studio`}><ArrowLeft size={15} />{t.studio.backToStudio}</Link>
    <header><p className="eyebrow">{t.studio.assets}</p><h1>{t.studio.mediaLibrary}</h1></header>
    <AttachmentUploader onComplete={() => client.invalidateQueries({ queryKey: ["media"] })} labels={{ title: locale === "zh-CN" ? "上传资源" : "Upload asset", choose: locale === "zh-CN" ? "选择文件" : "Choose file" }} />
    <div className="studio-filters"><select value={category} onChange={(event) => { setCategory(event.target.value); setCursor(undefined); }}><option value="">All categories</option>{["image","audio","video","document","archive","file"].map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); }}><option value="">All states</option>{["pending_upload","scanning","scan_parked","ready","rejected","trashed"].map((value) => <option key={value}>{value}</option>)}</select></div>
    {media.error && <p className="form-error">{media.error.message}</p>}
    {empty ? <div className="studio-empty"><div className="empty-orbit"><span /><span /><span /></div><h2>{t.studio.mediaEmptyTitle}</h2><p>{t.studio.mediaEmptyBody}</p></div> : null}
    <div className="media-grid">{media.data?.items.map((item) => <article key={item.id}><div className="media-preview">{item.category === "image" && item.status === "ready" ? <img src={item.content_url} alt="" /> : <span>{item.category}</span>}</div><strong title={item.filename}>{item.filename}</strong><span>{item.status} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB</span><div>{item.status === "ready" && <a className="button-link" href={item.content_url}><Download size={14} />{t.studio.download}</a>}{item.status === "trashed" ? <Button variant="outline" size="sm" onClick={() => mutate.mutate({ id: item.id, restore: true })}><RotateCcw size={14} />{t.studio.restore}</Button> : <Button variant="outline" size="sm" onClick={() => setPendingTrash(item)}><Trash2 size={14} />{t.studio.trash}</Button>}</div></article>)}</div>
    {media.data?.page?.has_more && <Button variant="outline" onClick={() => setCursor(media.data?.page?.next_cursor)}>{t.studio.loadMore}</Button>}
    <AppDialog
      open={Boolean(pendingTrash)}
      title={t.studio.trashMedia}
      description={pendingTrash ? t.studio.trashMediaBody.replace("{name}", pendingTrash.filename) : undefined}
      confirmLabel={t.common.confirm}
      cancelLabel={t.common.cancel}
      onClose={() => setPendingTrash(null)}
      onConfirm={() => {
        if (pendingTrash) mutate.mutate({ id: pendingTrash.id, restore: false });
        setPendingTrash(null);
      }}
    />
  </section>;
}
