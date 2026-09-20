"use client";

import { FormEvent, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor } from "@tiptap/react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { ChevronDown, History, Maximize2, MoreHorizontal, Settings, Share2, Trash2, X } from "lucide-react";
import { EditorCanvas } from "@/components/studio/editor-canvas";
import { AppDialog } from "@/components/ui/dialog";
import { documentsApi } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import { membersApi, versionsApi } from "@/lib/api/collaboration";
import { KnowledgeWebSocketProvider, type CollaborationStatus } from "@/lib/collaboration/provider";
import { uploadAttachmentFile } from "@/components/studio/attachment-uploader";
import { mapPublishError, publishAfterSync, waitForPublishReady } from "@/lib/editor/publish-sync";
import { normalizeLinkHref } from "@/lib/editor/selection-toolbar";
import { encodeRawUrlBase64 } from "@/lib/editor/state-vector";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";
import { getMessages } from "@/lib/i18n";

type EditorMenu = "share" | "more" | null;
type EditorMode = "edit" | "read";
type EditorWidth = "comfortable" | "wide";

function collaborationLabel(
  status: CollaborationStatus,
  labels: ReturnType<typeof getMessages>["editor"],
) {
  return labels[status];
}

function sanitizeEditorError(value: string, labels: ReturnType<typeof getMessages>["editor"]) {
  if (!value) return "";
  return mapPublishError(new Error(value), labels);
}

export function DocumentEditor({ documentId, locale }: { documentId: string; locale: string }) {
  return <DocumentEditorSession key={documentId} documentId={documentId} locale={locale} />;
}

function DocumentEditorSession({ documentId, locale }: { documentId: string; locale: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = getMessages(locale);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<KnowledgeWebSocketProvider | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [status, setStatus] = useState<CollaborationStatus>("connecting");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [autosaveNotice, setAutosaveNotice] = useState("");
  const [panel, setPanel] = useState<"settings" | "versions" | null>(null);
  const [menu, setMenu] = useState<EditorMenu>(null);
  const [modePreference, setModePreference] = useState<EditorMode>("edit");
  const [editorWidth, setEditorWidth] = useState<EditorWidth>("comfortable");
  const [editorWidthLoaded, setEditorWidthLoaded] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "delete-document" }
    | { kind: "add-member" }
    | { kind: "remove-member"; userId: string; revision: number; name: string }
    | { kind: "restore-version"; versionId: string; sequence: number }
    | { kind: "set-link"; href: string }
    | null
  >(null);
  const [dialogPending, setDialogPending] = useState(false);
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentKindRef = useRef<"image" | "attachment">("attachment");
  const attachmentPositionRef = useRef<number | null>(null);
  const lastAutosaveReminderRef = useRef(0);
  const persistenceRef = useRef<{ whenSynced: Promise<unknown> } | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentsApi.get(documentId).then((value) => value.data),
    refetchInterval: (query) => (["publishing", "unpublishing"].includes(query.state.data?.publication_status ?? "") ? 2000 : false),
  });
  const folders = useQuery({ queryKey: ["folders", "root"], queryFn: () => foldersApi.list().then((value) => value.data.items) });
  const members = useQuery({
    queryKey: ["members", documentId],
    queryFn: () => membersApi.list(documentId).then((value) => value.data.items),
    enabled: menu === "share",
  });
  const versions = useQuery({
    queryKey: ["versions", documentId],
    queryFn: () => versionsApi.list(documentId).then((value) => value.data),
    enabled: panel === "versions",
  });
  const metadataRevision = documentQuery.data?.metadata_revision;
  // TipTap 3 requires a schema top node (`doc`); never pass an empty extensions array.
  // TipTap 3 需要 schema 顶层节点 `doc`；协作未就绪时也不得传入空扩展数组。
  const editor = useEditor({
    extensions: createStudioDocumentExtensions(
      doc && provider
        ? {
            collaboration: { document: doc, field: "default" },
            collaborationCaret: { provider: provider as never, user: { name: "You", color: "#6678ff" } },
          }
        : undefined,
    ),
    editorProps: { attributes: { class: "document-editor-content" } },
  }, [doc, provider]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("knowledge-core:editor-width");
        if (saved === "wide" || saved === "comfortable") setEditorWidth(saved);
      } catch {
        // Layout preference is best-effort.
      } finally {
        setEditorWidthLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const ydoc = new Y.Doc();
    let currentProvider: KnowledgeWebSocketProvider | null = null;
    const persistence = new IndexeddbPersistence(`knowledge-core:${documentId}`, ydoc);
    persistenceRef.current = persistence;
    void persistence.whenSynced.then(async () => {
      try {
        if (!active) return;
        const nextProvider = new KnowledgeWebSocketProvider(
          () => documentsApi.session(documentId).then((value) => value.data),
          ydoc,
          {
            onStatus: (nextStatus) => { if (active) setStatus(nextStatus); },
            onError: (reason) => { if (active) setError(sanitizeEditorError(reason.message, t.editor)); },
            onTerminal: (closeCode) => {
              if (!active || closeCode !== 4409) return;
              setStatus("offline");
              setError(t.editor.documentRestored);
              void persistence.clearData().then(() => {
                if (active) {
                  setDoc(null);
                  setProvider(null);
                  setStatus("connecting");
                  setSessionEpoch((value) => value + 1);
                }
              }).catch((reason: unknown) => {
                if (active) setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.collaborationResetFailed);
              });
            },
          },
        );
        currentProvider = nextProvider;
        setDoc(ydoc);
        setProvider(nextProvider);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.collaborationStartFailed);
          setStatus("offline");
        }
      }
    });
    return () => {
      active = false;
      currentProvider?.destroy();
      persistence.destroy();
      ydoc.destroy();
      persistenceRef.current = null;
    };
    // The provider is intentionally created once for this document.
  }, [documentId, sessionEpoch, t.editor]);

  const canEdit = documentQuery.data?.access === "owner" || documentQuery.data?.access === "editor";
  const writing = canEdit && modePreference === "edit" && !publishing;
  const remoteTitle = documentQuery.data?.title ?? "";
  const titleDraft = titleOverride ?? remoteTitle;

  useEffect(() => {
    editor?.setEditable(writing);
  }, [editor, writing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastAutosaveReminderRef.current < 30_000) return;
      lastAutosaveReminderRef.current = now;
      setAutosaveNotice(t.editor.autosaveReminder);
      window.setTimeout(() => setAutosaveNotice(""), 2_400);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [t.editor.autosaveReminder]);

  useEffect(() => {
    if (!editorWidthLoaded) return;
    try {
      window.localStorage.setItem("knowledge-core:editor-width", editorWidth);
    } catch {
      // Storage can be unavailable in privacy mode.
    }
  }, [editorWidth, editorWidthLoaded]);

  useEffect(() => {
    if (!menu && !panel) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenu(null);
        setPanel(null);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menu, panel]);

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setError("");
    try {
      if (!metadataRevision) throw new Error("metadata");
      const idempotencyKey = crypto.randomUUID();
      const result = await publishAfterSync({
        wait: () => waitForPublishReady({
          persistenceSynced: persistenceRef.current?.whenSynced ?? Promise.reject(new Error("Collaboration is not ready")),
          provider,
        }),
        flush: () => provider?.flushAndSync() ?? Promise.reject(new Error("Collaboration is not ready")),
        encodeStateVector: () => {
          if (!doc) throw new Error("Collaboration is not ready");
          return encodeRawUrlBase64(Y.encodeStateVector(doc));
        },
        publish: (stateVector) => documentsApi.publish(documentId, metadataRevision, stateVector, idempotencyKey).then((value) => value.data),
        flushAndSync: () => provider?.flushAndSync() ?? Promise.reject(new Error("Collaboration is not ready")),
      });
      queryClient.setQueryData(["document", documentId], result);
    } catch (reason) {
      if (reason instanceof Error && reason.message === "metadata") setError(t.editor.metadataNotReady);
      else setError(mapPublishError(reason, t.editor));
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    if (!metadataRevision) return;
    setPublishing(true);
    setError("");
    try {
      await documentsApi.unpublish(documentId, metadataRevision);
      await documentQuery.refetch();
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.unpublishFailed);
    } finally {
      setPublishing(false);
    }
  }

  async function saveTitle() {
    if (!documentQuery.data || !canEdit) return;
    const title = titleDraft.trim();
    if (!title) {
      setTitleOverride(null);
      return;
    }
    if (title === remoteTitle) {
      setTitleOverride(null);
      return;
    }
    try {
      const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, { title });
      queryClient.setQueryData(["document", documentId], result.data);
      setTitleOverride(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.updateFailed);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentQuery.data) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, {
        summary: String(form.get("summary") ?? ""),
        slug: String(form.get("slug") ?? ""),
        language: String(form.get("language") ?? ""),
        tags: String(form.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        folder_id: String(form.get("folder_id") ?? ""),
      });
      queryClient.setQueryData(["document", documentId], result.data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.updateFailed);
    }
  }

  async function changeMember(userId: string, revision: number, role: "viewer" | "editor") {
    try {
      await membersApi.update(documentId, userId, revision, role);
      await members.refetch();
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.memberUpdateFailed);
    }
  }

  function closeDialog() {
    setDialog(null);
  }

  // Keep the selection range before the link dialog steals focus.
  // 链接对话框抢焦点前先记下选区，避免选区丢失。
  function requestLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    linkRangeRef.current = { from, to };
    setDialog({ kind: "set-link", href: String(editor.getAttributes("link").href ?? "") });
  }

  function requestAttachment(kind: "image" | "attachment") {
    if (!writing) return;
    attachmentKindRef.current = kind;
    attachmentPositionRef.current = editor?.state.selection.from ?? null;
    attachmentInputRef.current?.click();
  }

  async function insertAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !editor) return;
    setError("");
    try {
      const attachment = await uploadAttachmentFile(file);
      const kind = attachmentKindRef.current;
      const position = attachmentPositionRef.current;
      attachmentPositionRef.current = null;
      const chain = editor.chain().focus();
      if (position !== null) chain.setTextSelection(position);
      chain.insertContent({
        type: kind === "image" ? "image" : "attachment",
        attrs: { attachmentId: attachment.id, ...(kind === "image" ? { alt: file.name } : { title: file.name }) },
      }).run();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.editor.attachmentUploadFailed);
    }
  }

  // Confirm member/version/trash actions through AppDialog; cancel must not hit Gateway.
  // 成员/版本/删除走 AppDialog 确认；取消时不得调用 Gateway。
  async function confirmDialog(value: string) {
    if (!dialog || dialogPending) return;
    if (dialog.kind === "set-link") {
      const href = normalizeLinkHref(value);
      const range = linkRangeRef.current;
      if (editor && range && href) {
        editor.chain().focus().setTextSelection(range).setLink({ href }).run();
      }
      setDialog(null);
      return;
    }
    setDialogPending(true);
    setError("");
    try {
      if (dialog.kind === "delete-document") {
        if (!documentQuery.data) return;
        await documentsApi.remove(documentId, documentQuery.data.metadata_revision);
        router.push(`/${locale}/studio`);
        return;
      }
      if (dialog.kind === "add-member") {
        await membersApi.add(documentId, value, "viewer");
        await members.refetch();
      }
      if (dialog.kind === "remove-member") {
        await membersApi.remove(documentId, dialog.userId, dialog.revision);
        await members.refetch();
      }
      if (dialog.kind === "restore-version") {
        await waitForPublishReady({
          persistenceSynced: persistenceRef.current?.whenSynced ?? Promise.reject(new Error("Collaboration is not ready")),
          provider,
        });
        await provider?.flushAndSync();
        const refreshed = await versions.refetch();
        const expectedSequence = refreshed.data?.head_sequence ?? dialog.sequence;
        await versionsApi.restore(documentId, dialog.versionId, expectedSequence, crypto.randomUUID());
        window.location.reload();
        return;
      }
      setDialog(null);
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.requestFailed);
    } finally {
      setDialogPending(false);
    }
  }

  const publicationStatus = documentQuery.data?.publication_status;
  const publicationPending = publicationStatus === "publishing" || publicationStatus === "unpublishing";
  const synced = Boolean(provider?.isSynced);
  const statusText = canEdit ? collaborationLabel(status, t.editor) : t.editor.readOnly;
  const visibleError = sanitizeEditorError(error || documentQuery.data?.publication_error || "", t.editor);
  const ownerName = documentQuery.data?.owner.username ?? "";
  const updatedAt = documentQuery.data?.updated_at
    ? new Date(documentQuery.data.updated_at).toLocaleString(locale)
    : "";
  const byline = t.editor.byline.replace("{author}", ownerName).replace("{time}", updatedAt);
  const publishDisabled = publishing || publicationPending || !canEdit || !synced || !writing;
  const publishLabel = documentQuery.data?.published
    ? t.editor.unpublish
    : (publishing || publicationStatus === "publishing" ? t.editor.publishing : t.editor.publish);

  return (
    <>
      <header className="editor-page-heading" ref={headerRef}>
        <span
          className="editor-sync-dot"
          data-status={canEdit ? status : "connected"}
          title={statusText}
          aria-label={statusText}
        />
        <div className="editor-header-actions">
          {documentQuery.data?.access === "owner" ? (
            <div className="editor-popover-wrap">
              <button
                type="button"
                aria-expanded={menu === "share"}
                onClick={() => setMenu(menu === "share" ? null : "share")}
              >
                <Share2 size={15} />
                {t.editor.share}
              </button>
              {menu === "share" ? (
                <div className="editor-popover editor-share-popover" role="region" aria-label={t.studio.members}>
                  <div className="editor-popover-head">
                    <strong>{t.studio.members}</strong>
                    <button type="button" onClick={() => setDialog({ kind: "add-member" })}>{t.studio.addMember}</button>
                  </div>
                  {members.data?.map((member) => (
                    <article className="panel-row" key={member.user.id}>
                      <div>
                        <strong>{member.user.username}</strong>
                        <span>{member.role === "editor" ? t.studio.editor : t.studio.viewer}</span>
                      </div>
                      <select value={member.role} onChange={(event) => void changeMember(member.user.id, member.revision, event.target.value as "viewer" | "editor")}>
                        <option value="viewer">{t.studio.viewer}</option>
                        <option value="editor">{t.studio.editor}</option>
                      </select>
                      <button type="button" onClick={() => setDialog({ kind: "remove-member", userId: member.user.id, revision: member.revision, name: member.user.username })}>{t.studio.removeMember}</button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="editor-mode-control">
            <span className="visually-hidden">{t.editor.mode}</span>
            <select
              aria-label={t.editor.mode}
              value={writing ? "edit" : "read"}
              disabled={!canEdit}
              onChange={(event) => setModePreference(event.target.value as EditorMode)}
            >
              <option value="edit">{t.editor.editMode}</option>
              <option value="read">{t.editor.readMode}</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <div className="editor-popover-wrap editor-panel-anchor">
            <button type="button" aria-label={t.editor.more} aria-expanded={menu === "more"} onClick={() => { setPanel(null); setMenu(menu === "more" ? null : "more"); }}>
              <MoreHorizontal size={16} />
            </button>
            {menu === "more" ? (
              <div className="editor-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => { setPanel(panel === "settings" ? null : "settings"); setMenu(null); }}>
                  <Settings size={14} />
                  {t.studio.documentSettings}
                </button>
                <button type="button" role="menuitem" onClick={() => { setPanel(panel === "versions" ? null : "versions"); setMenu(null); }}>
                  <History size={14} />
                  {t.studio.versionHistory}
                </button>
              </div>
            ) : null}
            {panel ? (
              <div className="editor-popover editor-panel editor-floating-panel" role="region" aria-label={panel === "settings" ? t.studio.documentSettings : t.studio.versionHistory}>
                <div className="editor-panel-head">
                  <h2>{panel === "settings" ? t.studio.documentSettings : t.studio.versionHistory}</h2>
                  <button type="button" className="editor-panel-close" aria-label={t.editor.closePanel} onClick={() => setPanel(null)}><X size={15} /></button>
                </div>
                {panel === "settings" && documentQuery.data ? (
                  <form onSubmit={saveMetadata}>
                    <label>{t.studio.summary}<textarea name="summary" defaultValue={documentQuery.data.summary} maxLength={1000} /></label>
                    <label>{t.studio.slug}<input name="slug" defaultValue={documentQuery.data.slug} /></label>
                    <label>{t.studio.language}<input name="language" defaultValue={documentQuery.data.language} /></label>
                    <label>{t.studio.tags}<input name="tags" defaultValue={documentQuery.data.tags?.join(", ")} /></label>
                    <label>{t.studio.folder}
                      <select name="folder_id" defaultValue={documentQuery.data.folder_id}>
                        <option value="">{t.studio.noFolder}</option>
                        {folders.data?.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
                      </select>
                    </label>
                    <div className="editor-width-control">
                      <span>{t.editor.editorWidth}</span>
                      <div role="group" aria-label={t.editor.editorWidth}>
                        <button type="button" className={editorWidth === "comfortable" ? "is-selected" : ""} onClick={() => setEditorWidth("comfortable")}><Maximize2 size={14} />{t.editor.widthComfortable}</button>
                        <button type="button" className={editorWidth === "wide" ? "is-selected" : ""} onClick={() => setEditorWidth("wide")}><Maximize2 size={14} />{t.editor.widthWide}</button>
                      </div>
                    </div>
                    <button type="submit">{t.studio.saveMetadata}</button>
                    <button className="danger-button" type="button" onClick={() => setDialog({ kind: "delete-document" })}>
                      <Trash2 size={14} />
                      {t.studio.deleteDocument}
                    </button>
                  </form>
                ) : null}
                {panel === "versions" ? (
                  <div>
                    <div className="editor-panel-subhead"><span>{t.studio.versionHistory}</span><span className="editor-panel-note">{t.editor.autosaveOnly}</span></div>
                    {versions.data?.items.map((version) => (
                      <article className="panel-row" key={version.id}>
                        <div>
                          <strong>{version.label || version.kind}</strong>
                          <span>#{version.sequence} · {new Date(version.created_at).toLocaleString(locale)}</span>
                        </div>
                        {canEdit ? <button type="button" onClick={() => setDialog({ kind: "restore-version", versionId: version.id, sequence: version.sequence })}>{t.studio.restore}</button> : null}
                      </article>
                    ))}
                    {versions.data?.items.length === 0 ? <p className="editor-panel-note">{t.editor.autosavePending}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {status === "offline" && provider ? (
            <button type="button" onClick={() => { setError(""); provider.retry(); }}>{t.common.retry}</button>
          ) : null}
          {documentQuery.data?.published ? (
            <button type="button" className="editor-publish-button" onClick={() => void unpublish()} disabled={publishing || publicationPending || !canEdit}>
              {publicationStatus === "unpublishing" ? t.editor.unpublishing : t.editor.unpublish}
            </button>
          ) : (
            <button type="button" className="editor-publish-button" onClick={() => void publish()} disabled={publishDisabled}>
              {publishLabel}
            </button>
          )}
        </div>
      </header>
      <div className="editor-layout">
        <section className="document-editor-shell">
          {visibleError ? <p className="form-error">{visibleError}</p> : null}
          <div className={`document-editor-writing editor-width-${editorWidth}`}>
            <input
              className="document-editor-title"
              value={titleDraft}
              placeholder={t.editor.untitled}
              maxLength={200}
              disabled={!writing}
              aria-label={t.studio.documentTitle}
              onChange={(event) => setTitleOverride(event.target.value)}
              onBlur={() => void saveTitle()}
            />
            <p className="document-editor-byline">{byline}</p>
            <div className="document-editor-comment-gutter" aria-hidden="true" />
            <EditorCanvas editor={editor} locale={locale} onRequestLink={requestLink} onRequestAttachment={requestAttachment} />
          </div>
        </section>
      </div>
      {autosaveNotice ? <div className="editor-autosave-toast" role="status" aria-live="polite">{autosaveNotice}</div> : null}
      <input ref={attachmentInputRef} type="file" hidden accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(event) => void insertAttachment(event)} />
      <AppDialog
        key={dialog?.kind === "remove-member" ? `remove-${dialog.userId}` : dialog?.kind === "restore-version" ? `restore-${dialog.versionId}` : dialog?.kind === "set-link" ? "set-link" : dialog?.kind}
        open={Boolean(dialog)}
        title={dialog?.kind === "add-member" ? t.studio.addMember : dialog?.kind === "remove-member" ? t.studio.removeMember : dialog?.kind === "restore-version" ? t.studio.restoreVersion : dialog?.kind === "set-link" ? t.editor.linkTitle : t.studio.deleteDocument}
        description={dialog?.kind === "remove-member" ? t.studio.removeMemberBody.replace("{name}", dialog.name) : dialog?.kind === "restore-version" ? t.studio.restoreVersionBody : dialog?.kind === "delete-document" ? t.studio.deleteDocumentBody.replace("{name}", documentQuery.data?.title ?? "") : undefined}
        inputLabel={dialog?.kind === "add-member" ? t.studio.memberUsername : dialog?.kind === "set-link" ? t.editor.linkUrl : undefined}
        inputDefault={dialog?.kind === "set-link" ? dialog.href : undefined}
        inputRequired={dialog?.kind === "add-member" || dialog?.kind === "set-link"}
        confirmLabel={dialogPending ? t.common.working : dialog?.kind === "add-member" ? t.common.create : dialog?.kind === "restore-version" ? t.studio.restore : dialog?.kind === "set-link" ? t.editor.linkApply : t.common.confirm}
        cancelLabel={t.common.cancel}
        pending={dialogPending}
        onClose={closeDialog}
        onConfirm={(value) => void confirmDialog(value)}
      />
    </>
  );
}
