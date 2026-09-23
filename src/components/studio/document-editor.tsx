"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { ChevronDown, Clock3, Copy, ImagePlus, Maximize2, MoreHorizontal, Share2, SmilePlus } from "lucide-react";
import { EditorCanvas } from "@/components/studio/editor-canvas";
import { AppDialog } from "@/components/ui/dialog";
import { documentsApi } from "@/lib/api/documents";
import { membersApi } from "@/lib/api/collaboration";
import { KnowledgeWebSocketProvider, type CollaborationSaveState, type CollaborationStatus } from "@/lib/collaboration/provider";
import { uploadAttachmentFile } from "@/components/studio/attachment-uploader";
import { mapPublishError, publishAfterSync, waitForPublishReady } from "@/lib/editor/publish-sync";
import { normalizeLinkHref } from "@/lib/editor/selection-toolbar";
import { encodeRawUrlBase64 } from "@/lib/editor/state-vector";
import { publicationSemanticHash } from "@/lib/editor/semantic-hash";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";
import { replaceCollaborationDraft } from "@/lib/editor/restore-collaboration";
import { getMessages } from "@/lib/i18n";

type EditorMenu = "share" | "more" | "mode" | null;
type EditorMode = "edit" | "read";
type EditorWidth = "comfortable" | "wide";

const persistenceFallbackMs = 5_000;

function waitForPersistence(persistence: IndexeddbPersistence | null): Promise<void> {
  if (!persistence) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, persistenceFallbackMs);
    persistence.whenSynced.then(finish, finish);
  });
}

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

const emptyTags: string[] = [];

export function DocumentEditor({ documentId, locale }: { documentId: string; locale: string }) {
  return <DocumentEditorSession key={documentId} documentId={documentId} locale={locale} />;
}

function DocumentEditorSession({ documentId, locale }: { documentId: string; locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = getMessages(locale);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<KnowledgeWebSocketProvider | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [status, setStatus] = useState<CollaborationStatus>("connecting");
  const [saveState, setSaveState] = useState<CollaborationSaveState>("saved");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [autosaveNotice, setAutosaveNotice] = useState("");
  const [menu, setMenu] = useState<EditorMenu>(null);
  const [modePreference, setModePreference] = useState<EditorMode>("edit");
  const [editorWidth, setEditorWidth] = useState<EditorWidth>("comfortable");
  const [editorWidthLoaded, setEditorWidthLoaded] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null);
  const [draftHash, setDraftHash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "add-member" }
    | { kind: "remove-member"; userId: string; revision: number; name: string }
    | { kind: "set-link"; href: string }
    | null
  >(null);
  const [dialogPending, setDialogPending] = useState(false);
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentKindRef = useRef<"image" | "attachment" | "cover">("attachment");
  const attachmentPositionRef = useRef<number | null>(null);
  const persistenceRef = useRef<{ whenSynced: Promise<unknown> } | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const restoringCommitRef = useRef<string | null>(null);
  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentsApi.get(documentId).then((value) => value.data),
    refetchInterval: (query) => (["publishing", "unpublishing"].includes(query.state.data?.publication_status ?? "") ? 2000 : false),
  });
  const members = useQuery({
    queryKey: ["members", documentId],
    queryFn: () => membersApi.list(documentId).then((value) => value.data.items),
    enabled: menu === "share",
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
    let persistence: IndexeddbPersistence | null = null;
    try {
      persistence = new IndexeddbPersistence(`knowledge-core:${documentId}`, ydoc);
    } catch {
      // Private browsing and restricted storage can make IndexedDB unavailable.
      // The server-backed Y.Doc remains authoritative in that case.
    }
    const persistenceSynced = waitForPersistence(persistence);
    persistenceRef.current = { whenSynced: persistenceSynced };
    void persistenceSynced.then(async () => {
      try {
        if (!active) return;
        const nextProvider = new KnowledgeWebSocketProvider(
          () => documentsApi.session(documentId).then((value) => value.data),
          ydoc,
          {
            onStatus: (nextStatus) => { if (active) setStatus(nextStatus); },
            onSaveState: (nextSaveState) => { if (active) setSaveState(nextSaveState); },
            onError: (reason) => { if (active) setError(sanitizeEditorError(reason.message, t.editor)); },
            onTerminal: (closeCode) => {
              if (!active || closeCode !== 4409) return;
              setStatus("offline");
              setError(t.editor.documentRestored);
              const reset = persistence?.clearData() ?? Promise.resolve();
              void reset.then(() => {
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
      persistence?.destroy();
      ydoc.destroy();
      persistenceRef.current = null;
    };
    // The provider is intentionally created once for this document.
  }, [documentId, sessionEpoch, t.editor]);

  const canEdit = documentQuery.data?.access === "owner" || documentQuery.data?.access === "editor";

  useEffect(() => {
    if (!provider) return undefined;
    const flush = () => {
      void provider.flushOutbound().catch(() => undefined);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
    };
  }, [provider, canEdit]);

  useEffect(() => {
    if (modePreference === "read") void provider?.flushOutbound().catch(() => undefined);
  }, [modePreference, provider]);

  const writing = canEdit && modePreference === "edit" && !publishing;
  const remoteTitle = documentQuery.data?.title ?? "";
  const titleDraft = titleOverride ?? remoteTitle;
  const summaryDraft = summaryOverride ?? documentQuery.data?.summary ?? "";
  const tagsDraft = tagsOverride ?? documentQuery.data?.tags ?? emptyTags;

  useEffect(() => {
    if (!editor || !documentQuery.data) return undefined;
    let active = true;
    const refreshHash = () => {
      void publicationSemanticHash({
        title: titleDraft,
        summary: summaryDraft,
        slug: documentQuery.data?.slug ?? "",
        language: documentQuery.data?.language,
        tags: tagsDraft,
        content: editor.getJSON(),
        plainText: editor.getText(),
        icon: documentQuery.data?.icon,
        coverAttachmentId: documentQuery.data?.cover_attachment_id,
        coverFocalX: documentQuery.data?.cover_focal_x,
        coverFocalY: documentQuery.data?.cover_focal_y,
      }).then((value) => { if (active) setDraftHash(value); });
    };
    refreshHash();
    editor.on("update", refreshHash);
    return () => { active = false; editor.off("update", refreshHash); };
  }, [editor, documentQuery.data, summaryDraft, tagsDraft, titleDraft]);

  useEffect(() => {
    editor?.setEditable(writing);
  }, [editor, writing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      event.stopPropagation();
      void provider?.flushAndSync().then(() => {
        setAutosaveNotice(t.editor.autosaveReminder);
        window.setTimeout(() => setAutosaveNotice(""), 2_400);
      }).catch((reason: unknown) => {
        setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.collaborationSyncFailed);
      });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editor, provider, canEdit, documentQuery.data, t.editor]);

  useEffect(() => {
    if (!editorWidthLoaded) return;
    try {
      window.localStorage.setItem("knowledge-core:editor-width", editorWidth);
    } catch {
      // Storage can be unavailable in privacy mode.
    }
  }, [editorWidth, editorWidthLoaded]);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menu]);

  useEffect(() => {
    const commitId = searchParams.get("restore");
    if (!commitId || !editor || !provider || !canEdit || !documentQuery.data || status !== "connected" || !provider.isReady) return;
    if (restoringCommitRef.current === commitId) return;
    restoringCommitRef.current = commitId;
    const currentDocument = documentQuery.data;
    let active = true;
    void documentsApi.history.get(documentId, commitId).then(async ({ data: commit }) => {
      if (!active) return;
      if (!doc) throw new Error(t.editor.collaborationSyncFailed);
      replaceCollaborationDraft(editor, doc, commit.content as JSONContent);
      await provider.flushAndSync();
      const metadata = JSON.parse(commit.metadata_json) as Partial<{
        title: string; summary: string; language: string; tags: string[]; icon: string;
        cover_attachment_id: string; cover_focal_x: number; cover_focal_y: number;
      }>;
      if (Object.keys(metadata).length > 0) {
        await documentsApi.update(documentId, currentDocument.metadata_revision, metadata);
        await queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      }
      if (!active) return;
      setAutosaveNotice(t.editor.restoreSaved);
      window.setTimeout(() => setAutosaveNotice(""), 2_400);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("restore");
      router.replace(`/${locale}/studio/documents/${documentId}${next.size ? `?${next}` : ""}`);
    }).catch((reason: unknown) => {
      restoringCommitRef.current = null;
      if (active) setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.restoreFailed);
    });
    return () => { active = false; };
  }, [canEdit, doc, documentId, documentQuery.data, editor, locale, provider, queryClient, router, searchParams, status, t.editor]);

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setError("");
    try {
      const metadata = await flushPendingMetadata();
      const currentDocument = metadata ?? documentQuery.data;
      if (!currentDocument) throw new Error("metadata");
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
        publish: (stateVector) => documentsApi.publish(documentId, currentDocument.metadata_revision, stateVector, idempotencyKey, {
          icon: currentDocument.icon,
          cover_attachment_id: currentDocument.cover_attachment_id,
          cover_focal_x: currentDocument.cover_focal_x,
          cover_focal_y: currentDocument.cover_focal_y,
        }).then((value) => value.data),
        flushAndSync: () => provider?.flushAndSync() ?? Promise.reject(new Error("Collaboration is not ready")),
      });
      queryClient.setQueryData(["document", documentId], result);
      const targetGeneration = result.publication_generation;
      const targetHash = result.publication_hash;
      let confirmed = result;
      for (let attempt = 0; attempt < 20 && (confirmed.publication_status !== "published" || confirmed.publication_generation !== targetGeneration || confirmed.active_publication_hash !== targetHash); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        confirmed = (await documentsApi.get(documentId)).data;
        queryClient.setQueryData(["document", documentId], confirmed);
        if (confirmed.publication_status === "publish_failed") throw new Error(confirmed.publication_error || "publication failed");
      }
      if (confirmed.publication_status !== "published" || confirmed.active_publication_hash !== targetHash) {
        setAutosaveNotice(t.editor.publicationBackground);
        window.setTimeout(() => setAutosaveNotice(""), 4_000);
      }
    } catch (reason) {
      if (reason instanceof Error && reason.message === "metadata") setError(t.editor.metadataNotReady);
      else setError(mapPublishError(reason, t.editor));
    } finally {
      setPublishing(false);
    }
  }

  async function flushPendingMetadata() {
    if (!documentQuery.data || !canEdit) return null;
    const body: Parameters<typeof documentsApi.update>[2] = {};
    if (titleOverride !== null && titleOverride.trim() && titleOverride.trim() !== remoteTitle) body.title = titleOverride.trim();
    if (summaryOverride !== null && summaryOverride.trim() !== (documentQuery.data.summary ?? "")) body.summary = summaryOverride.trim();
    if (tagsOverride !== null && JSON.stringify(tagsOverride) !== JSON.stringify(documentQuery.data.tags ?? [])) body.tags = tagsOverride;
    if (Object.keys(body).length === 0) return null;
    const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, body);
    queryClient.setQueryData(["document", documentId], result.data);
    setTitleOverride(null);
    setSummaryOverride(null);
    setTagsOverride(null);
    return result.data;
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

  async function saveInlineMetadata(body: Parameters<typeof documentsApi.update>[2]) {
    if (!documentQuery.data || !canEdit) return;
    try {
      const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, body);
      queryClient.setQueryData(["document", documentId], result.data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? sanitizeEditorError(reason.message, t.editor) : t.editor.updateFailed);
    }
  }

  async function saveSummary() {
    await saveInlineMetadata({ summary: summaryDraft.trim() });
    setSummaryOverride(null);
  }

  async function saveTags() {
    await saveInlineMetadata({ tags: tagsDraft });
    setTagsOverride(null);
  }

  async function saveIcon(value: string) {
    await saveInlineMetadata({ icon: value.trim().slice(0, 8) });
  }

  async function removeCover() {
    await saveInlineMetadata({ cover_attachment_id: "" });
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

  function requestAttachment(kind: "image" | "attachment" | "cover") {
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
      if (kind === "cover") {
        if (!documentQuery.data) return;
        const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, { cover_attachment_id: attachment.id, cover_focal_x: 50, cover_focal_y: 50 });
        queryClient.setQueryData(["document", documentId], result.data);
        return;
      }
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

  // Confirm member/trash actions through AppDialog; cancel must not hit Gateway.
  // 成员/删除走 AppDialog 确认；取消时不得调用 Gateway。
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
      if (dialog.kind === "add-member") {
        await membersApi.add(documentId, value, "viewer");
        await members.refetch();
      }
      if (dialog.kind === "remove-member") {
        await membersApi.remove(documentId, dialog.userId, dialog.revision);
        await members.refetch();
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
  const collaborationReady = Boolean(provider?.isReady);
  const saveIndicatorState: CollaborationSaveState = !canEdit
    ? "saved"
    : status === "offline" || saveState === "offline-pending"
      ? "offline-pending"
      : status !== "connected" || saveState === "saving"
        ? "saving"
        : "saved";
  const [visibleSaveState, setVisibleSaveState] = useState<CollaborationSaveState>("saved");
  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisibleSaveState(saveIndicatorState),
      saveIndicatorState === "saving" ? 500 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [saveIndicatorState]);
  const statusText = canEdit ? collaborationLabel(status, t.editor) : t.editor.readOnly;
  const autosaveStatus = !canEdit
    ? t.editor.readOnly
    : visibleSaveState === "offline-pending"
      ? t.editor.offlinePending
      : visibleSaveState === "saved"
        ? t.editor.saved
        : t.editor.saving;
  const visibleError = sanitizeEditorError(error || documentQuery.data?.publication_error || "", t.editor);
  const ownerName = documentQuery.data?.owner.username ?? "";
  const updatedAt = documentQuery.data?.updated_at
    ? new Date(documentQuery.data.updated_at).toLocaleString(locale)
    : "";
  const byline = t.editor.byline.replace("{author}", ownerName).replace("{time}", updatedAt);
  // Publication is a document action, not an editing-mode action. Owners and
  // editors may publish/update from the mode menu even while they are reading.
  const publishDisabled = publishing || publicationPending || !canEdit || !collaborationReady;
  const publicationChanged = documentQuery.data?.published
    ? documentQuery.data.publication_hash
      ? draftHash !== null && draftHash !== documentQuery.data.publication_hash
      : true
    : false;
  const publishLabel = publishing || publicationStatus === "publishing"
    ? t.editor.publishing
    : publicationChanged ? t.editor.update : t.editor.alreadyLatest;

  return (
    <>
      <header className="editor-page-heading" ref={headerRef}>
        <span
          className="editor-sync-dot"
          data-status={canEdit ? status : "connected"}
          title={statusText}
          aria-label={statusText}
        />
        <span className="editor-autosave-status" role="status" aria-live="polite">{autosaveStatus}</span>
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
          <div className="editor-popover-wrap editor-mode-control">
            <button type="button" aria-label={t.editor.mode} aria-haspopup="menu" aria-expanded={menu === "mode"} disabled={!canEdit} onClick={() => setMenu(menu === "mode" ? null : "mode")}>
              {writing ? t.editor.editMode : t.editor.readMode}<ChevronDown size={14} aria-hidden="true" />
            </button>
            {menu === "mode" ? (
              <div className="editor-popover editor-mode-popover" role="menu">
                <button type="button" role="menuitemradio" aria-checked={modePreference === "edit"} onClick={() => { setModePreference("edit"); setMenu(null); }}>{t.editor.editMode}</button>
                <button type="button" role="menuitemradio" aria-checked={modePreference === "read"} onClick={() => { setModePreference("read"); setMenu(null); }}>{t.editor.readMode}</button>
                <div className="editor-publication-toggle">
                  <span>{documentQuery.data?.published ? t.editor.publishedVisibility : t.editor.publishVisibility}</span>
                  <button
                    type="button"
                    className="editor-publication-switch"
                    role="switch"
                    aria-label={documentQuery.data?.published ? t.editor.unpublish : t.editor.publish}
                    aria-checked={Boolean(documentQuery.data?.published)}
                    data-state={documentQuery.data?.published ? "on" : "off"}
                    disabled={publishing || publicationPending || !canEdit || !collaborationReady}
                    onClick={() => void (documentQuery.data?.published ? unpublish() : publish())}
                  >
                    <span aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="editor-popover-wrap editor-panel-anchor">
            <button type="button" aria-label={t.editor.more} aria-expanded={menu === "more"} onClick={() => setMenu(menu === "more" ? null : "more")}>
              <MoreHorizontal size={16} />
            </button>
            {menu === "more" ? (
              <div className="editor-popover editor-more-popover" role="menu">
                <div className="editor-menu-group"><span>{t.editor.pageTools}</span>
                  <button type="button" role="menuitem" onClick={() => { setEditorWidth(editorWidth === "wide" ? "comfortable" : "wide"); setMenu(null); }}><Maximize2 size={14} />{t.editor.pageLayout}</button>
                </div>
                <div className="editor-menu-group"><span>{t.editor.documentTools}</span>
                  <button type="button" role="menuitem" onClick={() => { router.push(`/${locale}/studio/documents/${documentId}/history`); setMenu(null); }}><Clock3 size={14} />{t.editor.history}</button>
                  <button type="button" role="menuitem" onClick={() => setMenu(null)}><Copy size={14} />{t.editor.copyToKnowledgeBase}</button>
                </div>
              </div>
            ) : null}
          </div>
          {status === "offline" && provider ? (
            <button type="button" onClick={() => { setError(""); provider.retry(); }}>{t.common.retry}</button>
          ) : null}
          {documentQuery.data?.published ? (
            <button type="button" className="editor-publish-button" onClick={() => void publish()} disabled={publishDisabled || !publicationChanged}>
              {publishLabel}
            </button>
          ) : null}
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
            <div className="document-editor-title-tools">
              <button type="button" className="editor-inline-tool" aria-label={t.editor.addIcon} onClick={() => {
                const value = window.prompt(t.editor.iconPrompt, documentQuery.data?.icon ?? "");
                if (value !== null) void saveIcon(value);
              }} disabled={!writing}>
                {documentQuery.data?.icon || <SmilePlus size={14} />}
              </button>
              {!documentQuery.data?.cover_attachment_id ? (
                <button type="button" className="editor-inline-tool" onClick={() => requestAttachment("cover")} disabled={!writing}><ImagePlus size={14} />{t.editor.addCover}</button>
              ) : (
                <button type="button" className="editor-inline-tool" onClick={() => void removeCover()} disabled={!writing}>{t.editor.removeCover}</button>
              )}
            </div>
            {documentQuery.data?.cover_attachment_id ? (
              <div className="document-editor-cover"><img src={`/api/bff/gateway/api/v1/attachments/${encodeURIComponent(documentQuery.data.cover_attachment_id)}/content`} alt="" style={{ objectPosition: `${documentQuery.data.cover_focal_x ?? 50}% ${documentQuery.data.cover_focal_y ?? 50}%` }} /></div>
            ) : null}
            <p className="document-editor-byline">{byline}</p>
            <div className="document-editor-inline-metadata">
              {writing || summaryDraft ? <input value={summaryDraft} placeholder={t.editor.addSummary} maxLength={1000} onChange={(event) => setSummaryOverride(event.target.value)} onBlur={() => void saveSummary()} aria-label={t.editor.addSummary} /> : <button type="button" onClick={() => setSummaryOverride("")} disabled={!writing}>{t.editor.addSummary}</button>}
              {writing || tagsDraft.length > 0 ? <input value={tagsDraft.join(", ")} placeholder={t.editor.addTags} onChange={(event) => setTagsOverride(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} onBlur={() => void saveTags()} aria-label={t.editor.addTags} /> : <button type="button" onClick={() => setTagsOverride([])} disabled={!writing}>{t.editor.addTags}</button>}
            </div>
            <div className="document-editor-comment-gutter" aria-hidden="true" />
            <EditorCanvas editor={editor} locale={locale} onRequestLink={requestLink} onRequestAttachment={requestAttachment} />
          </div>
        </section>
      </div>
      {autosaveNotice ? <div className="editor-autosave-toast" role="status" aria-live="polite">{autosaveNotice}</div> : null}
      <input ref={attachmentInputRef} type="file" hidden accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(event) => void insertAttachment(event)} />
      <AppDialog
        key={dialog?.kind === "remove-member" ? `remove-${dialog.userId}` : dialog?.kind === "set-link" ? "set-link" : dialog?.kind}
        open={Boolean(dialog)}
        title={dialog?.kind === "add-member" ? t.studio.addMember : dialog?.kind === "remove-member" ? t.studio.removeMember : dialog?.kind === "set-link" ? t.editor.linkTitle : t.studio.deleteDocument}
        description={dialog?.kind === "remove-member" ? t.studio.removeMemberBody.replace("{name}", dialog.name) : undefined}
        inputLabel={dialog?.kind === "add-member" ? t.studio.memberUsername : dialog?.kind === "set-link" ? t.editor.linkUrl : undefined}
        inputDefault={dialog?.kind === "set-link" ? dialog.href : undefined}
        inputRequired={dialog?.kind === "add-member" || dialog?.kind === "set-link"}
        confirmLabel={dialogPending ? t.common.working : dialog?.kind === "add-member" ? t.common.create : dialog?.kind === "set-link" ? t.editor.linkApply : t.common.confirm}
        cancelLabel={t.common.cancel}
        pending={dialogPending}
        onClose={closeDialog}
        onConfirm={(value) => void confirmDialog(value)}
      />
    </>
  );
}
