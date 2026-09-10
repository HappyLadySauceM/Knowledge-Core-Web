"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FolderPlus, LoaderCircle, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { documentsApi, type DocumentFilters } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import type { DocumentSummary, Folder } from "@/lib/api/types";

function message(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }

export function StudioFolders({ selected, onSelect }: { selected?: string; onSelect?: (id?: string) => void } = {}) {
  const client = useQueryClient();
  const folders = useQuery({ queryKey: ["folders", "root"], queryFn: () => foldersApi.list().then((value) => value.data.items) });
  const create = useMutation({ mutationFn: (name: string) => foldersApi.create(name), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const update = useMutation({ mutationFn: ({ folder, name }: { folder: Folder; name: string }) => foldersApi.update(folder.id, folder.revision, { name }), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const remove = useMutation({ mutationFn: (folder: Folder) => foldersApi.remove(folder.id, folder.revision), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  function add() { const name = window.prompt("Folder name"); if (name?.trim()) create.mutate(name.trim()); }
  function rename(folder: Folder) { const name = window.prompt("Rename folder", folder.name); if (name?.trim() && name.trim() !== folder.name) update.mutate({ folder, name: name.trim() }); }
  function destroy(folder: Folder) { if (window.confirm(`Delete “${folder.name}”?`)) remove.mutate(folder); }
  return <div className="folder-tree">
    <button type="button" className={!selected ? "selected" : ""} onClick={() => onSelect?.()}><span>▱</span>All folders</button>
    {folders.data?.map((folder) => <div className="folder-tree-row" key={folder.id}><button type="button" className={selected === folder.id ? "selected" : ""} onClick={() => onSelect?.(folder.id)}><span>▱</span>{folder.name}</button><button type="button" aria-label={`Rename ${folder.name}`} onClick={() => rename(folder)}><Pencil size={12} /></button><button type="button" aria-label={`Delete ${folder.name}`} onClick={() => destroy(folder)}><Trash2 size={12} /></button></div>)}
    <button type="button" onClick={add}><FolderPlus size={14} />New folder</button>
    {(folders.error || create.error || update.error || remove.error) && <p className="form-error">{message(folders.error || create.error || update.error || remove.error)}</p>}
  </div>;
}

export function StudioClient({ locale, labels }: { locale: string; labels: { emptyTitle: string; emptyBody: string; newDocument: string; loading: string; failed: string } }) {
  const client = useQueryClient();
  const router = useRouter();
  const [filters, setFilters] = useState<DocumentFilters>({ limit: 50 });
  const [pages, setPages] = useState<DocumentSummary[]>([]);
  const [folder, setFolder] = useState<string>();
  const query = useQuery({ queryKey: ["documents", filters], queryFn: () => documentsApi.list(filters).then((result) => result.data) });
  const create = useMutation({ mutationFn: (title: string) => documentsApi.create({ title }), onSuccess: ({ data }) => { client.invalidateQueries({ queryKey: ["documents"] }); router.push(`/${locale}/studio/documents/${data.id}`); } });
  const items = useMemo(() => [...pages, ...(query.data?.items ?? [])].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).filter((item) => !folder || item.folder_id === folder), [pages, query.data, folder]);
  function newDocument() { const title = window.prompt(locale === "zh-CN" ? "文档标题" : "Document title"); if (title?.trim()) create.mutate(title.trim()); }
  function changeFilters(next: Partial<DocumentFilters>) { setPages([]); setFilters((current) => ({ ...current, ...next, cursor: undefined })); }
  function loadMore() { if (!query.data?.page.next_cursor) return; setPages((current) => [...current, ...query.data.items]); setFilters((current) => ({ ...current, cursor: query.data?.page.next_cursor })); }
  return <div className="studio-workspace">
    <aside className="studio-filter-panel"><div className="studio-folders-title"><span>Folders</span></div><StudioFolders selected={folder} onSelect={setFolder} /><Link href={`/${locale}/studio/media`}>Media library</Link><Link href={`/${locale}/studio/trash`}>Trash</Link></aside>
    <section className="studio-main-panel"><div className="studio-heading"><div><p className="eyebrow">{locale === "zh-CN" ? "你的工作区" : "Your workspace"}</p><h1>{locale === "zh-CN" ? "全部文档" : "All documents"}</h1></div><Button onClick={newDocument} disabled={create.isPending}><FilePlus2 size={16} />{create.isPending ? "Creating…" : labels.newDocument}</Button></div>
      <div className="studio-filters"><label><Search size={15} /><input aria-label="Search documents" placeholder={locale === "zh-CN" ? "搜索文档" : "Search documents"} onChange={(event) => changeFilters({ q: event.target.value })} /></label><select aria-label="Access" onChange={(event) => changeFilters({ access: (event.target.value || undefined) as DocumentFilters["access"] })}><option value="">All access</option><option value="owner">Owned</option><option value="shared">Shared</option></select><select aria-label="Publication" onChange={(event) => changeFilters({ publication: (event.target.value || undefined) as DocumentFilters["publication"] })}><option value="">All states</option><option value="draft">Draft</option><option value="published">Published</option></select></div>
      {(create.error || query.error) && <div className="studio-empty"><h2>{labels.failed}</h2><p>{message(create.error || query.error)}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></div>}
      {query.isLoading && <div className="studio-loading"><LoaderCircle className="spin" size={22} />{labels.loading}</div>}
      {!query.isLoading && !query.error && items.length === 0 && <div className="studio-empty"><div className="empty-orbit"><span /><span /><span /></div><h2>{labels.emptyTitle}</h2><p>{labels.emptyBody}</p><Button variant="secondary" onClick={newDocument}><FilePlus2 size={16} />{labels.newDocument}</Button></div>}
      {items.length > 0 && <div className="studio-document-list">{items.map((document) => <Link key={document.id} href={`/${locale}/studio/documents/${document.id}`} className="studio-document-row"><div><p>{document.tags?.[0] ?? (document.published ? "Published" : "Draft")}</p><h2>{document.title}</h2><span>{document.summary || "No summary yet"}</span></div><div className="document-row-meta"><span>{document.access}</span><time dateTime={document.updated_at}>{new Date(document.updated_at).toLocaleDateString(locale)}</time></div></Link>)}</div>}
      {query.data?.page.has_more && <Button variant="outline" onClick={loadMore} disabled={query.isFetching}>Load more</Button>}
    </section>
  </div>;
}
