"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FolderPlus, LoaderCircle, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/dialog";
import { documentsApi, type DocumentFilters } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import type { DocumentSummary, Folder } from "@/lib/api/types";
import { getMessages } from "@/lib/i18n";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";

function message(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }

type FolderDialog =
  | { kind: "create" }
  | { kind: "rename"; folder: Folder }
  | { kind: "delete"; folder: Folder };

export function StudioFolders({ locale, selected, onSelect }: { locale: string; selected?: string; onSelect?: (id?: string) => void } = { locale: "zh-CN" }) {
  const t = getMessages(locale);
  const client = useQueryClient();
  const [dialog, setDialog] = useState<FolderDialog | null>(null);
  const folders = useQuery({ queryKey: ["folders", "root"], queryFn: () => foldersApi.list().then((value) => value.data.items) });
  const create = useMutation({ mutationFn: (name: string) => foldersApi.create(name), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const update = useMutation({ mutationFn: ({ folder, name }: { folder: Folder; name: string }) => foldersApi.update(folder.id, folder.revision, { name }), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const remove = useMutation({ mutationFn: (folder: Folder) => foldersApi.remove(folder.id, folder.revision), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });

  function confirmFolder(value: string) {
    if (dialog?.kind === "create" && value) create.mutate(value);
    if (dialog?.kind === "rename" && value && value !== dialog.folder.name) update.mutate({ folder: dialog.folder, name: value });
    if (dialog?.kind === "delete") remove.mutate(dialog.folder);
    setDialog(null);
  }

  return <div className="folder-tree">
    <button type="button" className={!selected ? "selected" : ""} onClick={() => onSelect?.()}><span>▱</span>{t.studio.allFolders}</button>
    {folders.data?.map((folder) => <div className="folder-tree-row" key={folder.id}><button type="button" className={selected === folder.id ? "selected" : ""} onClick={() => onSelect?.(folder.id)}><span>▱</span>{folder.name}</button><button type="button" aria-label={`${t.studio.renameFolder} ${folder.name}`} onClick={() => setDialog({ kind: "rename", folder })}><Pencil size={12} /></button><button type="button" aria-label={`${t.studio.deleteFolder} ${folder.name}`} onClick={() => setDialog({ kind: "delete", folder })}><Trash2 size={12} /></button></div>)}
    <button type="button" onClick={() => setDialog({ kind: "create" })}><FolderPlus size={14} />{t.studio.newFolder}</button>
    {(folders.error || create.error || update.error || remove.error) && <p className="form-error">{message(folders.error || create.error || update.error || remove.error)}</p>}
    <AppDialog
      key={dialog?.kind === "rename" || dialog?.kind === "delete" ? `${dialog.kind}-${dialog.folder.id}` : dialog?.kind}
      open={Boolean(dialog)}
      title={dialog?.kind === "rename" ? t.studio.renameFolder : dialog?.kind === "delete" ? t.studio.deleteFolder : t.studio.newFolder}
      description={dialog?.kind === "delete" ? t.studio.deleteFolderBody.replace("{name}", dialog.folder.name) : undefined}
      inputLabel={dialog?.kind === "delete" ? undefined : t.studio.folderName}
      inputDefault={dialog?.kind === "rename" ? dialog.folder.name : ""}
      confirmLabel={dialog?.kind === "delete" ? t.common.delete : dialog?.kind === "rename" ? t.common.save : t.common.create}
      cancelLabel={t.common.cancel}
      onClose={() => setDialog(null)}
      onConfirm={confirmFolder}
    />
  </div>;
}

export function StudioClient({ locale }: { locale: string }) {
  const t = getMessages(locale);
  const client = useQueryClient();
  const router = useRouter();
  const [filters, setFilters] = useState<DocumentFilters>({ limit: 50 });
  const [searchInput, setSearchInput] = useState("");
  const [pages, setPages] = useState<DocumentSummary[]>([]);
  const [folder, setFolder] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const listFilters = { ...filters, q: debouncedSearch || undefined };
  const query = useQuery({ queryKey: ["documents", listFilters], queryFn: () => documentsApi.list(listFilters).then((result) => result.data) });
  const create = useMutation({ mutationFn: (title: string) => documentsApi.create({ title }), onSuccess: ({ data }) => { client.invalidateQueries({ queryKey: ["documents"] }); router.push(`/${locale}/studio/documents/${data.id}`); } });
  const items = useMemo(() => [...pages, ...(query.data?.items ?? [])].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).filter((item) => !folder || item.folder_id === folder), [pages, query.data, folder]);
  function changeFilters(next: Partial<DocumentFilters>) { setPages([]); setFilters((current) => ({ ...current, ...next, cursor: undefined })); }
  function loadMore() { if (!query.data?.page.next_cursor) return; setPages((current) => [...current, ...query.data.items]); setFilters((current) => ({ ...current, cursor: query.data?.page.next_cursor })); }
  function confirmDocument(title: string) {
    if (title) create.mutate(title);
    setCreateOpen(false);
  }
  return <div className="studio-workspace">
    <aside className="studio-filter-panel"><div className="studio-folders-title"><span>{t.studio.folders}</span></div><StudioFolders locale={locale} selected={folder} onSelect={setFolder} /><Link href={`/${locale}/studio/media`}>{t.studio.mediaLibrary}</Link><Link href={`/${locale}/studio/trash`}>{t.studio.trash}</Link></aside>
    <section className="studio-main-panel"><div className="studio-heading"><div><p className="eyebrow">{t.studio.eyebrow}</p><h1>{t.studio.title}</h1></div><Button onClick={() => setCreateOpen(true)} disabled={create.isPending}><FilePlus2 size={16} />{create.isPending ? t.studio.creating : t.studio.newDocument}</Button></div>
      <div className="studio-filters"><label><Search size={15} /><input aria-label={t.studio.searchDocuments} placeholder={t.studio.searchDocuments} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label><select aria-label={t.studio.access} onChange={(event) => changeFilters({ access: (event.target.value || undefined) as DocumentFilters["access"] })}><option value="">{t.studio.allAccess}</option><option value="owner">{t.studio.owned}</option><option value="shared">{t.studio.shared}</option></select><select aria-label={t.studio.publication} onChange={(event) => changeFilters({ publication: (event.target.value || undefined) as DocumentFilters["publication"] })}><option value="">{t.studio.allStates}</option><option value="draft">{t.studio.draft}</option><option value="published">{t.studio.published}</option></select></div>
      {(create.error || query.error) && <div className="studio-empty"><h2>{t.studio.failed}</h2><p>{message(create.error || query.error)}</p><Button variant="secondary" onClick={() => void query.refetch()}>{t.common.retry}</Button></div>}
      {query.isLoading && <div className="studio-loading"><LoaderCircle className="spin" size={22} />{t.studio.loading}</div>}
      {!query.isLoading && !query.error && items.length === 0 && <div className="studio-empty"><div className="empty-orbit"><span /><span /><span /></div><h2>{t.studio.emptyTitle}</h2><p>{t.studio.emptyBody}</p><Button variant="secondary" onClick={() => setCreateOpen(true)}><FilePlus2 size={16} />{t.studio.newDocument}</Button></div>}
      {items.length > 0 && <div className="studio-document-list">{items.map((document) => <Link key={document.id} href={`/${locale}/studio/documents/${document.id}`} className="studio-document-row"><div><p>{document.tags?.[0] ?? (document.published ? t.studio.published : t.studio.draft)}</p><h2>{document.title}</h2><span>{document.summary || t.studio.noSummary}</span></div><div className="document-row-meta"><span>{document.access}</span><time dateTime={document.updated_at}>{new Date(document.updated_at).toLocaleDateString(locale)}</time></div></Link>)}</div>}
      {query.data?.page.has_more && <Button variant="outline" onClick={loadMore} disabled={query.isFetching}>{t.studio.loadMore}</Button>}
    </section>
    <AppDialog
      open={createOpen}
      title={t.studio.newDocument}
      inputLabel={t.studio.documentTitle}
      confirmLabel={t.common.create}
      cancelLabel={t.common.cancel}
      onClose={() => setCreateOpen(false)}
      onConfirm={confirmDocument}
    />
  </div>;
}
