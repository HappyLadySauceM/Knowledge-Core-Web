import type { AnyExtension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import type * as Y from "yjs";

type CollaborationCaretUser = { name: string; color: string };

// Shared TipTap extensions for the Studio document canvas (tests omit Yjs).
// Studio 文档画布共用的 TipTap 扩展（测试可省略 Yjs）。
export function createStudioDocumentExtensions(options?: {
  collaboration?: { document: Y.Doc; field?: string };
  collaborationCaret?: { provider: never; user: CollaborationCaretUser };
}): AnyExtension[] {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      ...(options?.collaboration ? { undoRedo: false } : {}),
      link: { openOnClick: false },
      // StarterKit 3 also ships underline; keep a single mark instance.
      // StarterKit 3 也内置 underline，关掉以免重复注册。
      underline: false,
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
  ];
  if (options?.collaboration) {
    extensions.push(Collaboration.configure(options.collaboration));
  }
  if (options?.collaborationCaret) {
    extensions.push(CollaborationCaret.configure(options.collaborationCaret));
  }
  return extensions;
}
