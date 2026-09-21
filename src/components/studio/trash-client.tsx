"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/dialog";
import { documentsApi } from "@/lib/api/documents";

export function TrashClient({ locale }: { locale: string }) {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; title: string; revision: number } | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const trash = useQuery({ queryKey: ["trash", q], queryFn: () => documentsApi.trash({ q, limit: 50 }).then((value) => value.data) });
  const restore = useMutation({ mutationFn: documentsApi.restore, onSuccess: () => { client.invalidateQueries({ queryKey: ["trash"] }); client.invalidateQueries({ queryKey: ["documents"] }); } });
  const purge = useMutation({ mutationFn: ({ id, revision }: { id: string; revision: number }) => documentsApi.purge(id, revision), onSuccess: () => { setPurgeError(null); setPurgeTarget(null); client.invalidateQueries({ queryKey: ["trash"] }); client.invalidateQueries({ queryKey: ["documents"] }); }, onError: (error: Error) => setPurgeError(error.message) });
  const zh = locale === "zh-CN";
  return <>
    <section className="management-page"><label className="management-search"><Search size={15} /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder={zh ? "搜索已删除文档" : "Search deleted documents"} /></label>{trash.error && <p className="form-error">{trash.error.message}</p>}<div className="management-list">{trash.data?.items.map((document) => <article key={document.id}><div><strong>{document.title}</strong><span>{new Date(document.deleted_at ?? document.updated_at).toLocaleString(locale)}</span></div><div className="management-actions"><Button variant="outline" size="sm" onClick={() => restore.mutate(document.id)} disabled={restore.isPending || purge.isPending}><RotateCcw size={14} />{zh ? "恢复" : "Restore"}</Button><Button variant="outline" size="sm" onClick={() => setPurgeTarget({ id: document.id, title: document.title, revision: document.metadata_revision })} disabled={restore.isPending || purge.isPending}><Trash2 size={14} />{zh ? "永久删除" : "Delete permanently"}</Button></div></article>)}</div>{!trash.isLoading && !trash.data?.items.length && <p className="empty-inline">{zh ? "回收站是空的。" : "Trash is empty."}</p>}</section>
    {purgeError && <p className="form-error" role="alert">{purgeError}</p>}<AppDialog open={Boolean(purgeTarget)} title={zh ? "永久删除文档？" : "Delete document permanently?"} description={zh ? `“${purgeTarget?.title ?? ""}”将立即从回收站移除，且无法恢复。` : `“${purgeTarget?.title ?? ""}” will be removed immediately and cannot be restored.`} confirmLabel={purge.isPending ? (zh ? "删除中…" : "Deleting…") : (zh ? "永久删除" : "Delete permanently")} cancelLabel={zh ? "取消" : "Cancel"} pending={purge.isPending} onClose={() => { if (!purge.isPending) setPurgeTarget(null); }} onConfirm={() => { if (purgeTarget) { setPurgeError(null); purge.mutate({ id: purgeTarget.id, revision: purgeTarget.revision }); } }} />
  </>;
}
