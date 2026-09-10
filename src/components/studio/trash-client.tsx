"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentsApi } from "@/lib/api/documents";

export function TrashClient({ locale }: { locale: string }) {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const trash = useQuery({ queryKey: ["trash", q], queryFn: () => documentsApi.trash({ q, limit: 50 }).then((value) => value.data) });
  const restore = useMutation({ mutationFn: documentsApi.restore, onSuccess: () => { client.invalidateQueries({ queryKey: ["trash"] }); client.invalidateQueries({ queryKey: ["documents"] }); } });
  return <section className="management-page"><Link className="back-link-static" href={`/${locale}/studio`}><ArrowLeft size={15} />{locale === "zh-CN" ? "返回工作区" : "Back to studio"}</Link><header><p className="eyebrow">Studio</p><h1>{locale === "zh-CN" ? "回收站" : "Trash"}</h1></header><label className="management-search"><Search size={15} /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={locale === "zh-CN" ? "搜索已删除文档" : "Search deleted documents"} /></label>{trash.error && <p className="form-error">{trash.error.message}</p>}<div className="management-list">{trash.data?.items.map((document) => <article key={document.id}><div><strong>{document.title}</strong><span>{new Date(document.deleted_at ?? document.updated_at).toLocaleString(locale)}</span></div><Button variant="outline" size="sm" onClick={() => restore.mutate(document.id)} disabled={restore.isPending}><RotateCcw size={14} />{locale === "zh-CN" ? "恢复" : "Restore"}</Button></article>)}</div>{!trash.isLoading && !trash.data?.items.length && <p className="empty-inline">{locale === "zh-CN" ? "回收站是空的。" : "Trash is empty."}</p>}</section>;
}
