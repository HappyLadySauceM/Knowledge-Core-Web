"use client";

import { useEffect, useMemo, useState } from "react";
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
import { apiFetch } from "@/lib/api/client";
import type { CollaborationSession, DocumentSummary } from "@/lib/api/types";
import { KnowledgeWebSocketProvider } from "@/lib/collaboration/provider";

function base64url(value: Uint8Array) {
  let binary = "";
  value.forEach((item) => { binary += String.fromCharCode(item); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function DocumentEditor({ documentId }: { documentId: string }) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<KnowledgeWebSocketProvider | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");
  const [metadataRevision, setMetadataRevision] = useState<number | null>(null);
  const [transaction, setTransaction] = useState(0);
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
    void apiFetch<DocumentSummary>(`/api/v1/studio/documents/${documentId}`).then((value) => { if (active) setMetadataRevision(value.metadata_revision); }).catch(() => undefined);
    const persistence = new IndexeddbPersistence(`knowledge-core:${documentId}`, ydoc);
    void persistence.whenSynced.then(async () => {
      try {
        const session = await apiFetch<CollaborationSession>(`/api/v1/studio/documents/${documentId}/collaboration-sessions`, { method: "POST", body: "{}" });
        if (!active) return;
        const nextProvider = new KnowledgeWebSocketProvider(session.websocket_url, session.ticket, session.subprotocol, ydoc);
        currentProvider = nextProvider;
        nextProvider.awareness.on("change", () => setStatus("Connected"));
        setDoc(ydoc); setProvider(nextProvider); setStatus("Syncing…");
      } catch (reason) { if (active) { setError(reason instanceof Error ? reason.message : "Unable to start collaboration"); setStatus("Offline"); } }
    });
    return () => { active = false; currentProvider?.destroy(); persistence.destroy(); ydoc.destroy(); };
    // The provider is intentionally created once for this document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const stateVector = useMemo(() => (doc ? base64url(Y.encodeStateVector(doc)) : ""), [doc, transaction]);

  async function publish() {
    if (!stateVector || publishing) return;
    setPublishing(true); setError("");
    try {
      if (!metadataRevision) throw new Error("Document metadata is not ready");
      await apiFetch(`/api/v1/studio/documents/${documentId}/publication`, { method: "PUT", headers: { "If-Match": `"${metadataRevision}"`, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ state_vector: stateVector }) });
      setPublished(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Publish failed"); }
    finally { setPublishing(false); }
  }

  return <section className="document-editor-shell"><div className="document-editor-toolbar"><span className="editor-status">{status}</span><button type="button" onClick={() => void publish()} disabled={publishing || !editor || status === "Offline"}>{publishing ? "Publishing…" : published ? "Published" : "Publish"}</button></div>{error && <p className="form-error">{error}</p>}<EditorContent editor={editor} /></section>;
}
