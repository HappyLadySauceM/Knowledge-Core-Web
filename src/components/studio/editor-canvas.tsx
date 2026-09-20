"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { editorMenuStyle, shouldShowSelectionToolbar } from "@/lib/editor/selection-toolbar";
import { Plus } from "lucide-react";
import {
  applySlashCommand,
  filterSlashCommands,
  handleSlashMenuKeydown,
  isEmptyParagraphCaret,
  matchSlashInEditor,
  openSlashOnEmptyLine,
  type SlashCommandId,
  type SlashMatch,
} from "@/lib/editor/slash-commands";
import { getMessages } from "@/lib/i18n";
import { EditorSelectionToolbar } from "@/components/studio/editor-selection-toolbar";
import { EditorSlashMenu } from "@/components/studio/editor-slash-menu";

type EditorCanvasProps = {
  editor: Editor | null;
  locale: string;
  onRequestLink: () => void;
  onRequestAttachment?: (kind: "image" | "attachment") => void;
};

// TipTap 3 throws until EditorContent mounts the ProseMirror view.
// TipTap 3 在 EditorContent 挂上 ProseMirror view 之前访问 view.dom 会抛错。
function editorViewDom(editor: Editor): HTMLElement | null {
  try {
    return editor.view.dom;
  } catch {
    return null;
  }
}

function insertControlStyle(editor: Editor): CSSProperties {
  try {
    const rect = editor.view.coordsAtPos(editor.state.selection.from);
    if (!rect || (rect.top === 0 && rect.left === 0 && rect.bottom === 0)) {
      return { position: "fixed", top: 120, left: 16, zIndex: 20 };
    }
    return {
      position: "fixed",
      top: Math.round(rect.top + (rect.bottom - rect.top) / 2 - 11),
      left: Math.max(8, Math.round(rect.left - 36)),
      zIndex: 20,
    };
  } catch {
    return { position: "fixed", top: 120, left: 16, zIndex: 20 };
  }
}

export function EditorCanvas({ editor, locale, onRequestLink, onRequestAttachment }: EditorCanvasProps) {

  const t = getMessages(locale);
  const [slash, setSlash] = useState<SlashMatch | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setRenderTick] = useState(0);
  const queryRef = useRef("");
  const dismissedKeyRef = useRef<string | null>(null);
  const items = useMemo(() => filterSlashCommands(slash?.query ?? ""), [slash?.query]);
  const activeIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);
  const slashOpen = Boolean(slash);
  const showToolbar = editor ? shouldShowSelectionToolbar(editor, slashOpen) : false;
  const showInsert = Boolean(editor?.isEditable && !slashOpen && editor && isEmptyParagraphCaret(editor));

  const runSlash = useCallback((id: SlashCommandId) => {
    if (!editor || !slash) return;
    applySlashCommand(editor, slash, id);
    if (id === "link") onRequestLink();
    if (id === "image") onRequestAttachment?.("image");
    if (id === "videoFile") onRequestAttachment?.("attachment");
  }, [editor, slash, onRequestLink, onRequestAttachment]);

  useEffect(() => {
    if (!editor) return undefined;
    const sync = () => {
      const match = matchSlashInEditor(editor);
      const nextQuery = match?.query ?? "";
      if (queryRef.current !== nextQuery) {
        queryRef.current = nextQuery;
        setSelectedIndex(0);
      }
      if (!match) {
        dismissedKeyRef.current = null;
        setSlash(null);
      } else if (`${match.from}:${match.query}` === dismissedKeyRef.current) {
        setSlash(null);
      } else {
        setSlash(match);
      }
      setRenderTick((value) => value + 1);
    };
    editor.on("transaction", sync);
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("transaction", sync);
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!slash) return;
      const handled = handleSlashMenuKeydown(event, {
        itemCount: items.length,
        selectedIndex: activeIndex,
        onIndexChange: setSelectedIndex,
        onConfirm: () => {
          const item = items[activeIndex];
          if (!item) return;
          runSlash(item.id);
        },
        onClose: () => {
          dismissedKeyRef.current = `${slash.from}:${slash.query}`;
          setSlash(null);
        },
      });
      if (handled) event.stopPropagation();
    };
    let viewDom: HTMLElement | null = null;
    const attach = () => {
      if (viewDom) return;
      viewDom = editorViewDom(editor);
      if (!viewDom) return;
      // Capture so Enter/Escape reach the menu before ProseMirror inserts a paragraph.
      // 在捕获阶段拦截，避免 Enter/Escape 先被 ProseMirror 当成换段。
      viewDom.addEventListener("keydown", onKeyDown, true);
    };
    attach();
    editor.on("create", attach);
    return () => {
      editor.off("create", attach);
      viewDom?.removeEventListener("keydown", onKeyDown, true);
    };
  }, [editor, slash, items, activeIndex, onRequestLink, runSlash]);

  return (
    <div className="document-editor-canvas">
      <EditorContent editor={editor} />
      {editor && slash && slashOpen ? (
        <EditorSlashMenu
          items={items}
          selectedIndex={activeIndex}
          labels={t.editor}
          style={editorMenuStyle(editor, slash.from, "below")}
          onHover={setSelectedIndex}
          onSelect={runSlash}
        />
      ) : null}
      {editor && showInsert ? (
        <button
          type="button"
          className="editor-insert-control"
          aria-label={t.editor.slashLabel}
          style={insertControlStyle(editor)}
          onMouseDown={(event) => {
            event.preventDefault();
            openSlashOnEmptyLine(editor);
          }}
        >
          <Plus size={14} />
        </button>
      ) : null}
      {editor && showToolbar ? (
        <EditorSelectionToolbar
          editor={editor}
          labels={t.editor}
          style={editorMenuStyle(editor, editor.state.selection.from, "above")}
          onRequestLink={onRequestLink}
        />
      ) : null}
    </div>
  );
}
