"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { editorMenuStyle, shouldShowSelectionToolbar } from "@/lib/editor/selection-toolbar";
import {
  applySlashCommand,
  filterSlashCommands,
  handleSlashMenuKeydown,
  matchSlashInEditor,
  type SlashMatch,
} from "@/lib/editor/slash-commands";
import { getMessages } from "@/lib/i18n";
import { EditorSelectionToolbar } from "@/components/studio/editor-selection-toolbar";
import { EditorSlashMenu } from "@/components/studio/editor-slash-menu";

type EditorCanvasProps = {
  editor: Editor | null;
  locale: string;
  onRequestLink: () => void;
};

export function EditorCanvas({ editor, locale, onRequestLink }: EditorCanvasProps) {
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
          applySlashCommand(editor, slash, item.id);
        },
        onClose: () => {
          dismissedKeyRef.current = `${slash.from}:${slash.query}`;
          setSlash(null);
        },
      });
      if (handled) event.stopPropagation();
    };
    // Capture so Enter/Escape reach the menu before ProseMirror inserts a paragraph.
    // 在捕获阶段拦截，避免 Enter/Escape 先被 ProseMirror 当成换段。
    editor.view.dom.addEventListener("keydown", onKeyDown, true);
    return () => editor.view.dom.removeEventListener("keydown", onKeyDown, true);
  }, [editor, slash, items, activeIndex]);

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
          onSelect={(id) => {
            applySlashCommand(editor, slash, id);
          }}
        />
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
