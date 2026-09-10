"use client";
/* eslint-disable @next/next/no-img-element -- authenticated media URLs resolve through a short-lived 303 redirect. */

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, RotateCcw, Trash2 } from "lucide-react";
import { AttachmentUploader } from "@/components/studio/attachment-uploader";
import { Button } from "@/components/ui/button";
import { mediaApi } from "@/lib/api/media";

export function MediaLibrary({ locale }: { locale: string }) {
  const client = useQueryClient();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const media = useQuery({ queryKey: ["media", category, status, cursor], queryFn: () => mediaApi.list({ category, status, cursor, limit: 50 }).then((value) => value.data) });
  const mutate = useMutation({ mutationFn: async ({ id, restore }: { id: string; restore: boolean }) => { if (restore) await mediaApi.restore(id); else await mediaApi.remove(id); }, onSuccess: () => client.invalidateQueries({ queryKey: ["media"] }) });
  return <section className="management-page">
    <Link className="back-link-static" href={`/${locale}/studio`}><ArrowLeft size={15} />{locale === "zh-CN" ? "返回工作区" : "Back to studio"}</Link>
    <header><p className="eyebrow">Assets</p><h1>{locale === "zh-CN" ? "媒体库" : "Media library"}</h1></header>
    <AttachmentUploader onComplete={() => client.invalidateQueries({ queryKey: ["media"] })} labels={{ title: locale === "zh-CN" ? "上传资源" : "Upload asset", choose: locale === "zh-CN" ? "选择文件" : "Choose file" }} />
    <div className="studio-filters"><select value={category} onChange={(event) => { setCategory(event.target.value); setCursor(undefined); }}><option value="">All categories</option>{["image","audio","video","document","archive","file"].map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); }}><option value="">All states</option>{["pending_upload","scanning","scan_parked","ready","rejected","trashed"].map((value) => <option key={value}>{value}</option>)}</select></div>
    {media.error && <p className="form-error">{media.error.message}</p>}
    <div className="media-grid">{media.data?.items.map((item) => <article key={item.id}><div className="media-preview">{item.category === "image" && item.status === "ready" ? <img src={item.content_url} alt="" /> : <span>{item.category}</span>}</div><strong title={item.filename}>{item.filename}</strong><span>{item.status} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB</span><div>{item.status === "ready" && <a className="button-link" href={item.content_url}><Download size={14} />Download</a>}{item.status === "trashed" ? <Button variant="outline" size="sm" onClick={() => mutate.mutate({ id: item.id, restore: true })}><RotateCcw size={14} />Restore</Button> : <Button variant="outline" size="sm" onClick={() => { if (confirm(`Move “${item.filename}” to trash?`)) mutate.mutate({ id: item.id, restore: false }); }}><Trash2 size={14} />Trash</Button>}</div></article>)}</div>
    {media.data?.page?.has_more && <Button variant="outline" onClick={() => setCursor(media.data?.page?.next_cursor)}>Load more</Button>}
  </section>;
}
