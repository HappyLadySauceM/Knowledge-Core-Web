import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { updateYFragment } from "@tiptap/y-tiptap";
import type * as Y from "yjs";

// Replace the authoritative Yjs fragment, rather than only repainting the
// ProseMirror view. The generated Yjs update is what Collaboration persists
// and what a later publication snapshot captures.
export function replaceCollaborationDraft(editor: Editor, document: Y.Doc, content: JSONContent) {
  // Lightweight component tests and emergency non-collaborative shells may not
  // expose a ProseMirror schema. Production collaboration always does.
  if (!editor.schema) {
    editor.commands.setContent(content);
    return;
  }
  const node = editor.schema.nodeFromJSON(content);
  const fragment = document.getXmlFragment("default");
  updateYFragment(document, fragment, node, { mapping: new Map(), isOMark: new Map() });
}
