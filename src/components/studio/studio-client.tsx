"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronRight, FilePlus2, FileText, Folder as FolderIcon, FolderPlus, Library, LoaderCircle, Pencil, Trash2, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/dialog";
import { documentsApi, type DocumentFilters } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import type { DocumentSummary, Folder } from "@/lib/api/types";
import { getMessages } from "@/lib/i18n";

function message(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }

type FolderDialog =
  | { kind: "create"; parent?: Folder }
  | { kind: "rename"; folder: Folder }
  | { kind: "delete"; folder: Folder };

export type LibrarySelection = {
  library: "personal" | "knowledge";
  folder?: string;
  access?: DocumentFilters["access"];
  publication?: DocumentFilters["publication"];
};

function FolderBranch({ folder, locale, selected, onSelect, onDialog }: { folder: Folder; locale: string; selected?: string; onSelect?: (selection: LibrarySelection) => void; onDialog: (dialog: FolderDialog) => void }) {
  const t = getMessages(locale);
  const [expanded, setExpanded] = useState(false);
  const children = useQuery({
    queryKey: ["folders", folder.id],
    queryFn: () => foldersApi.list(folder.id).then((value) => value.data.items),
    enabled: expanded,
  });
  return <div className="folder-tree-branch" style={{ "--folder-depth": folder.depth } as CSSProperties}>
    <div className="folder-tree-row">
      <button type="button" className="folder-tree-expander" aria-label={`${expanded ? t.studio.collapseFolder : t.studio.expandFolder} ${folder.name}`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><ChevronRight size={13} /></button>
      <button type="button" className={selected === folder.id ? "selected" : ""} onClick={() => onSelect?.({ library: "personal", folder: folder.id })}><FolderIcon size={14} />{folder.name}</button>
      <button type="button" aria-label={`${t.studio.newSubfolder} ${folder.name}`} onClick={() => onDialog({ kind: "create", parent: folder })}><FolderPlus size={12} /></button>
      <button type="button" aria-label={`${t.studio.renameFolder} ${folder.name}`} onClick={() => onDialog({ kind: "rename", folder })}><Pencil size={12} /></button>
      <button type="button" aria-label={`${t.studio.deleteFolder} ${folder.name}`} onClick={() => onDialog({ kind: "delete", folder })}><Trash2 size={12} /></button>
    </div>
    {expanded ? <div className="folder-tree-children">
      {children.data?.map((child) => <FolderBranch key={child.id} folder={child} locale={locale} selected={selected} onSelect={onSelect} onDialog={onDialog} />)}
      {!children.isLoading && children.data?.length === 0 ? <p>{t.studio.emptyFolder}</p> : null}
    </div> : null}
  </div>;
}

export function StudioFolders({ locale, selected, access, publication, library = "personal", onSelect }: { locale: string; selected?: string; access?: DocumentFilters["access"]; publication?: DocumentFilters["publication"]; library?: LibrarySelection["library"]; onSelect?: (selection: LibrarySelection) => void } = { locale: "zh-CN" }) {
  const t = getMessages(locale);
  const client = useQueryClient();
  const [dialog, setDialog] = useState<FolderDialog | null>(null);
  const folders = useQuery({ queryKey: ["folders", "root"], queryFn: () => foldersApi.list().then((value) => value.data.items) });
  const create = useMutation({ mutationFn: ({ name, parentId }: { name: string; parentId?: string }) => foldersApi.create(name, parentId), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const update = useMutation({ mutationFn: ({ folder, name }: { folder: Folder; name: string }) => foldersApi.update(folder.id, folder.revision, { name }), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });
  const remove = useMutation({ mutationFn: (folder: Folder) => foldersApi.remove(folder.id, folder.revision), onSuccess: () => client.invalidateQueries({ queryKey: ["folders"] }) });

  function confirmFolder(value: string) {
    if (dialog?.kind === "create" && value) create.mutate({ name: value, parentId: dialog.parent?.id });
    if (dialog?.kind === "rename" && value && value !== dialog.folder.name) update.mutate({ folder: dialog.folder, name: value });
    if (dialog?.kind === "delete") remove.mutate(dialog.folder);
    setDialog(null);
  }

  const personalAllSelected = library === "personal" && !selected && !access && !publication;
  return <div className="folder-tree library-tree">
    <div className="library-tree-root">
      <button type="button" className={personalAllSelected ? "selected library-root-button" : "library-root-button"} onClick={() => onSelect?.({ library: "personal" })}><Library size={15} />{t.studio.personalLibrary}</button>
      <div className="library-tree-section">
        <button type="button" className={personalAllSelected ? "selected" : ""} onClick={() => onSelect?.({ library: "personal" })}><FileText size={14} />{t.studio.allDocuments}</button>
        <button type="button" className={library === "personal" && access === "owner" && !selected ? "selected" : ""} onClick={() => onSelect?.({ library: "personal", access: "owner" })}><UserRound size={14} />{t.studio.owned}</button>
        <button type="button" className={library === "personal" && access === "shared" && !selected ? "selected" : ""} onClick={() => onSelect?.({ library: "personal", access: "shared" })}><UsersRound size={14} />{t.studio.sharedWithMe}</button>
        <p className="library-tree-label">{t.studio.folders}</p>
        {folders.data?.map((folder) => <FolderBranch key={folder.id} folder={folder} locale={locale} selected={selected} onSelect={onSelect} onDialog={setDialog} />)}
        <button type="button" onClick={() => setDialog({ kind: "create" })}><FolderPlus size={14} />{t.studio.newFolder}</button>
      </div>
    </div>
    <div className="library-tree-root">
      <button type="button" className={library === "knowledge" ? "selected library-root-button" : "library-root-button"} onClick={() => onSelect?.({ library: "knowledge", publication: "published" })}><BookOpen size={15} />{t.studio.knowledgeBase}</button>
      <div className="library-tree-section"><button type="button" className={library === "knowledge" ? "selected" : ""} onClick={() => onSelect?.({ library: "knowledge", publication: "published" })}><FileText size={14} />{t.studio.publishedDocuments}</button></div>
    </div>
    {(folders.error || create.error || update.error || remove.error) && <p className="form-error">{message(folders.error || create.error || update.error || remove.error)}</p>}
    <AppDialog
      key={dialog?.kind === "rename" || dialog?.kind === "delete" ? `${dialog.kind}-${dialog.folder.id}` : dialog?.kind}
      open={Boolean(dialog)}
      title={dialog?.kind === "rename" ? t.studio.renameFolder : dialog?.kind === "delete" ? t.studio.deleteFolder : dialog?.parent ? t.studio.newSubfolder : t.studio.newFolder}
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
  const searchParams = useSearchParams();
  const [cursor, setCursor] = useState<string | undefined>();
  const [pages, setPages] = useState<DocumentSummary[]>([]);
  const [pagesSearch, setPagesSearch] = useState(searchParams.get("q") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState<DocumentSummary | null>(null);
  const [removedDocuments, setRemovedDocuments] = useState<string[]>([]);
  const search = searchParams.get("q") ?? "";
  const folder = searchParams.get("folder") ?? undefined;
  const access = (searchParams.get("access") || undefined) as DocumentFilters["access"];
  const publication = (searchParams.get("publication") || undefined) as DocumentFilters["publication"];
  const listFilters: DocumentFilters = { limit: 50, cursor, q: search || undefined, access, publication, folder_id: folder };
  const query = useQuery({ queryKey: ["documents", listFilters], queryFn: () => documentsApi.list(listFilters).then((result) => result.data) });
  const create = useMutation({ mutationFn: (title: string) => documentsApi.create({ title }), onSuccess: ({ data }) => { client.invalidateQueries({ queryKey: ["documents"] }); router.push(`/${locale}/studio/documents/${data.id}`); } });
  const remove = useMutation({ mutationFn: (document: DocumentSummary) => documentsApi.remove(document.id, document.metadata_revision), onSuccess: (_, document) => { setRemovedDocuments((current) => [...current, document.id]); setDeleteDocument(null); void client.invalidateQueries({ queryKey: ["documents"] }); } });
  const items = useMemo(() => [...(pagesSearch === search ? pages : []), ...(query.data?.items ?? [])].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).filter((item) => !removedDocuments.includes(item.id)), [pages, pagesSearch, query.data, removedDocuments, search]);
  const hasActiveFilters = Boolean(search || access || publication || folder);
  const isEmptyList = !query.isLoading && !query.error && items.length === 0;
  // Hide list filters until there are documents (or the user is already filtering).
  // 在尚无文档且未筛选时隐藏筛选条，避免空工作区只剩一排空控件。
  const showFilters = hasActiveFilters || items.length > 0;
  function changeFilters(nextValues: Partial<DocumentFilters>) {
    setPages([]);
    setCursor(undefined);
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["access", "publication"] as const) {
      const value = nextValues[key];
      if (value) next.set(key, value); else if (key in nextValues) next.delete(key);
    }
    next.delete("cursor");
    router.replace(`/${locale}/studio${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function loadMore() { if (!query.data?.page.next_cursor) return; setPagesSearch(search); setPages((current) => [...current, ...query.data.items]); setCursor(query.data.page.next_cursor); }
  function confirmDocument(title: string) {
    if (title) create.mutate(title);
    setCreateOpen(false);
  }
  return <div className="studio-workspace">
    <section className="studio-main-panel"><div className="studio-heading"><div><p className="eyebrow">{t.studio.eyebrow}</p><h1>{t.studio.title}</h1></div><Button onClick={() => setCreateOpen(true)} disabled={create.isPending}><FilePlus2 size={16} />{create.isPending ? t.studio.creating : t.studio.newDocument}</Button></div>
      {showFilters ? <div className="studio-filters"><select aria-label={t.studio.access} value={access ?? ""} onChange={(event) => changeFilters({ access: (event.target.value || undefined) as DocumentFilters["access"] })}><option value="">{t.studio.allAccess}</option><option value="owner">{t.studio.owned}</option><option value="shared">{t.studio.shared}</option></select><select aria-label={t.studio.publication} value={publication ?? ""} onChange={(event) => changeFilters({ publication: (event.target.value || undefined) as DocumentFilters["publication"] })}><option value="">{t.studio.allStates}</option><option value="draft">{t.studio.draft}</option><option value="published">{t.studio.published}</option></select></div> : null}
      {(create.error || remove.error || query.error) && <div className="studio-empty"><h2>{t.studio.failed}</h2><p>{message(create.error || remove.error || query.error)}</p><Button variant="secondary" onClick={() => void query.refetch()}>{t.common.retry}</Button></div>}
      {query.isLoading && <div className="studio-loading"><LoaderCircle className="spin" size={22} />{t.studio.loading}</div>}
      {isEmptyList && <div className="studio-empty" role="status">{!hasActiveFilters && <div className="empty-orbit" aria-hidden="true"><span /><span /><span /></div>}<h2>{hasActiveFilters ? t.studio.emptyFilteredTitle : t.studio.emptyTitle}</h2><p>{hasActiveFilters ? t.studio.emptyFilteredBody : t.studio.emptyBody}</p><Button onClick={() => setCreateOpen(true)} disabled={create.isPending}><FilePlus2 size={16} />{create.isPending ? t.studio.creating : t.studio.newDocument}</Button></div>}
      {items.length > 0 && <div className="studio-document-list">{items.map((document) => <article key={document.id} className="studio-document-row"><Link href={`/${locale}/studio/documents/${document.id}`} className="studio-document-row-link"><div><p>{document.tags?.[0] ?? (document.published ? t.studio.published : t.studio.draft)}</p><h2>{document.title}</h2><span>{document.summary || t.studio.noSummary}</span></div><div className="document-row-meta"><span>{document.access}</span><time dateTime={document.updated_at}>{new Date(document.updated_at).toLocaleDateString(locale)}</time></div></Link>{document.access === "owner" ? <button type="button" className="document-row-delete" aria-label={`${t.studio.deleteDocument} ${document.title}`} onClick={() => setDeleteDocument(document)}><Trash2 size={15} /></button> : null}</article>)}</div>}
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
    <AppDialog
      open={Boolean(deleteDocument)}
      title={t.studio.deleteDocument}
      description={deleteDocument ? t.studio.deleteDocumentBody.replace("{name}", deleteDocument.title) : undefined}
      confirmLabel={remove.isPending ? t.common.working : t.common.delete}
      cancelLabel={t.common.cancel}
      pending={remove.isPending}
      onClose={() => setDeleteDocument(null)}
      onConfirm={() => { if (deleteDocument) remove.mutate(deleteDocument); }}
    />
  </div>;
}
