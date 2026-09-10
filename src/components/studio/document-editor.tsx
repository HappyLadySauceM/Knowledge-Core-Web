"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { Bold, History, Italic, List, Redo2, Settings, Strikethrough, Trash2, Underline as UnderlineIcon, Undo2, Users } from "lucide-react";
import { documentsApi } from "@/lib/api/documents";
import { foldersApi } from "@/lib/api/folders";
import { membersApi, versionsApi } from "@/lib/api/collaboration";
import { KnowledgeWebSocketProvider, type CollaborationStatus } from "@/lib/collaboration/provider";

function base64url(value: Uint8Array) {
  let binary = "";
  value.forEach((item) => { binary += String.fromCharCode(item); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function statusLabel(status: CollaborationStatus) {
  switch (status) {
    case "connecting": return "Connecting…";
    case "syncing": return "Syncing…";
    case "connected": return "Connected";
    case "reconnecting": return "Reconnecting…";
    case "offline": return "Offline";
  }
}

export function DocumentEditor({ documentId, locale }: { documentId: string; locale: string }) {
  return <DocumentEditorSession key={documentId} documentId={documentId} locale={locale} />;
}

function DocumentEditorSession({ documentId, locale }: { documentId: string; locale: string }) {
  const router = useRouter(); const queryClient = useQueryClient();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<KnowledgeWebSocketProvider | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [status, setStatus] = useState("Connecting…");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(0);
  const [panel, setPanel] = useState<"settings" | "members" | "versions" | null>(null);
  const documentQuery = useQuery({ queryKey: ["document", documentId], queryFn: () => documentsApi.get(documentId).then((value) => value.data), refetchInterval: (query) => ["publishing", "unpublishing"].includes(query.state.data?.publication_status ?? "") ? 2000 : false });
  const folders = useQuery({ queryKey: ["folders", "root"], queryFn: () => foldersApi.list().then((value) => value.data.items) });
  const members = useQuery({ queryKey: ["members", documentId], queryFn: () => membersApi.list(documentId).then((value) => value.data.items), enabled: panel === "members" });
  const versions = useQuery({ queryKey: ["versions", documentId], queryFn: () => versionsApi.list(documentId).then((value) => value.data), enabled: panel === "versions" });
  const metadataRevision = documentQuery.data?.metadata_revision;
  const editor = useEditor({
    extensions: doc && provider ? [
      StarterKit.configure({ undoRedo: false }),
      Link.configure({ openOnClick: false }), Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }), TaskList, TaskItem.configure({ nested: true }),
      Collaboration.configure({ document: doc, field: provider ? "default" : undefined }),
      CollaborationCaret.configure({ provider: provider as never, user: { name: "You", color: "#6678ff" } }),
    ] : [],
    editorProps: { attributes: { class: "document-editor-content" } },
    onTransaction: () => setTransaction((value) => value + 1),
  }, [doc, provider]);

  useEffect(() => {
    let active = true;
    const ydoc = new Y.Doc();
    let currentProvider: KnowledgeWebSocketProvider | null = null;
    const persistence = new IndexeddbPersistence(`knowledge-core:${documentId}`, ydoc);
    void persistence.whenSynced.then(async () => {
      try {
        if (!active) return;
        const nextProvider = new KnowledgeWebSocketProvider(
          () => documentsApi.session(documentId).then((value) => value.data),
          ydoc,
          {
            onStatus: (nextStatus) => { if (active) setStatus(statusLabel(nextStatus)); },
            onError: (reason) => { if (active) setError(reason.message); },
            onTerminal: (closeCode) => {
              if (!active || closeCode !== 4409) return;
              setStatus("Offline");
              setError("Document was restored; reloading the collaboration state…");
              void persistence.clearData().then(() => {
                if (active) {
                  setDoc(null);
                  setProvider(null);
                  setStatus("Connecting…");
                  setSessionEpoch((value) => value + 1);
                }
              }).catch((reason: unknown) => {
                if (active) setError(reason instanceof Error ? reason.message : "Unable to reset collaboration state");
              });
            },
          },
        );
        currentProvider = nextProvider;
        setDoc(ydoc); setProvider(nextProvider);
      } catch (reason) { if (active) { setError(reason instanceof Error ? reason.message : "Unable to start collaboration"); setStatus("Offline"); } }
    });
    return () => { active = false; currentProvider?.destroy(); persistence.destroy(); ydoc.destroy(); };
    // The provider is intentionally created once for this document.
  }, [documentId, sessionEpoch]);

  useEffect(() => { editor?.setEditable(documentQuery.data?.access === "owner" || documentQuery.data?.access === "editor"); }, [editor, documentQuery.data?.access]);

  // Y.Doc is mutable; transaction is the explicit invalidation signal for its state vector.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stateVector = useMemo(() => (doc ? base64url(Y.encodeStateVector(doc)) : ""), [doc, transaction]);

  async function publish() {
    if (!stateVector || publishing) return;
    setPublishing(true); setError("");
    try {
      if (!metadataRevision) throw new Error("Document metadata is not ready");
      const result = await documentsApi.publish(documentId, metadataRevision, stateVector);
      queryClient.setQueryData(["document", documentId], result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Publish failed"); }
    finally { setPublishing(false); }
  }

  async function unpublish() { if (!metadataRevision) return; setPublishing(true); setError(""); try { await documentsApi.unpublish(documentId, metadataRevision); await documentQuery.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unpublish failed"); } finally { setPublishing(false); } }
  async function saveMetadata(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!documentQuery.data) return; const form = new FormData(event.currentTarget); try { const result = await documentsApi.update(documentId, documentQuery.data.metadata_revision, { title: String(form.get("title") ?? ""), summary: String(form.get("summary") ?? ""), slug: String(form.get("slug") ?? ""), language: String(form.get("language") ?? ""), tags: String(form.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean), folder_id: String(form.get("folder_id") ?? "") }); queryClient.setQueryData(["document", documentId], result.data); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Update failed"); } }
  async function deleteDocument() { if (!documentQuery.data || !confirm(`Delete “${documentQuery.data.title}”?`)) return; try { await documentsApi.remove(documentId, documentQuery.data.metadata_revision); router.push(`/${locale}/studio`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Delete failed"); } }
  async function addMember() { const username = prompt("Username"); if (!username?.trim()) return; try { await membersApi.add(documentId, username.trim(), "viewer"); await members.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add member"); } }
  async function changeMember(userId: string, revision: number, role: "viewer" | "editor") { try { await membersApi.update(documentId, userId, revision, role); await members.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update member"); } }
  async function removeMember(userId: string, revision: number) { if (!confirm("Remove this member?")) return; try { await membersApi.remove(documentId, userId, revision); await members.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove member"); } }
  async function createVersion() { const label = prompt("Version label (optional)") ?? undefined; try { await versionsApi.create(documentId, label); await versions.refetch(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create version"); } }
  async function restoreVersion(versionId: string, fallbackSequence: number) { try { const detail = await versionsApi.get(documentId, versionId); const preview = detail.data.plain_text.slice(0, 240) || "(empty document)"; if (!confirm(`Restore this version? Current collaborators will reconnect.\n\n${preview}`)) return; const expectedSequence = versions.data?.items[0]?.sequence ?? fallbackSequence; await versionsApi.restore(documentId, versionId, expectedSequence); window.location.reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to restore version"); } }

  const canEdit = documentQuery.data?.access === "owner" || documentQuery.data?.access === "editor";
  const publicationStatus = documentQuery.data?.publication_status;
  const publicationPending = publicationStatus === "publishing" || publicationStatus === "unpublishing";
  return <><header className="editor-page-heading"><div><p className="eyebrow">{documentQuery.data?.published ? "Published" : "Collaborative document"}</p><h1>{documentQuery.data?.title ?? "Loading…"}</h1><p className="document-editor-lede">{documentQuery.data?.summary || "Changes sync live and stay available while you reconnect."}</p></div><div className="editor-header-actions"><button onClick={() => setPanel(panel === "settings" ? null : "settings")}><Settings size={15} />Settings</button>{documentQuery.data?.access === "owner" && <button onClick={() => setPanel(panel === "members" ? null : "members")}><Users size={15} />Members</button>}<button onClick={() => setPanel(panel === "versions" ? null : "versions")}><History size={15} />Versions</button></div></header>
  <div className="editor-layout"><section className="document-editor-shell"><div className="document-editor-toolbar"><div className="format-tools"><button type="button" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></button><button type="button" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></button><button type="button" aria-label="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></button><button type="button" aria-label="Strike" onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></button><button type="button" aria-label="List" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></button><button type="button" aria-label="Undo" onClick={() => editor?.commands.undo()}><Undo2 size={15} /></button><button type="button" aria-label="Redo" onClick={() => editor?.commands.redo()}><Redo2 size={15} /></button></div><span className="editor-status">{publicationPending ? (publicationStatus === "publishing" ? "Publishing media…" : "Removing publication…") : canEdit ? status : "Read only"}</span>{status === "Offline" && provider && <button type="button" onClick={() => { setError(""); provider.retry(); }}>Retry</button>}{documentQuery.data?.published ? <button type="button" onClick={() => void unpublish()} disabled={publishing || publicationPending || !canEdit}>Unpublish</button> : <button type="button" onClick={() => void publish()} disabled={publishing || publicationPending || !editor || status === "Offline" || !canEdit}>{publishing || publicationStatus === "publishing" ? "Publishing…" : "Publish"}</button>}</div>{(error || documentQuery.data?.publication_error) && <p className="form-error">{error || documentQuery.data?.publication_error}</p>}<EditorContent editor={editor} /></section>
  {panel && <aside className="editor-panel">{panel === "settings" && documentQuery.data && <form onSubmit={saveMetadata}><h2>Document settings</h2><label>Title<input name="title" defaultValue={documentQuery.data.title} required maxLength={200} /></label><label>Summary<textarea name="summary" defaultValue={documentQuery.data.summary} maxLength={1000} /></label><label>Slug<input name="slug" defaultValue={documentQuery.data.slug} /></label><label>Language<input name="language" defaultValue={documentQuery.data.language} /></label><label>Tags<input name="tags" defaultValue={documentQuery.data.tags?.join(", ")} /></label><label>Folder<select name="folder_id" defaultValue={documentQuery.data.folder_id}><option value="">No folder</option>{folders.data?.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><button type="submit">Save metadata</button><button className="danger-button" type="button" onClick={() => void deleteDocument()}><Trash2 size={14} />Move to trash</button></form>}{panel === "members" && <div><h2>Members</h2><button type="button" onClick={() => void addMember()}>Add member</button>{members.data?.map((member) => <article className="panel-row" key={member.user.id}><div><strong>{member.user.username}</strong><span>{member.role}</span></div><select value={member.role} onChange={(event) => void changeMember(member.user.id, member.revision, event.target.value as "viewer" | "editor")}><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button type="button" onClick={() => void removeMember(member.user.id, member.revision)}>Remove</button></article>)}</div>}{panel === "versions" && <div><h2>Version history</h2>{canEdit && <button type="button" onClick={() => void createVersion()}>Create version</button>}{versions.data?.items.map((version) => <article className="panel-row" key={version.id}><div><strong>{version.label || version.kind}</strong><span>#{version.sequence} · {new Date(version.created_at).toLocaleString(locale)}</span></div>{canEdit && <button type="button" onClick={() => void restoreVersion(version.id, version.sequence)}>Restore</button>}</article>)}</div>}</aside>}</div></>;
}
