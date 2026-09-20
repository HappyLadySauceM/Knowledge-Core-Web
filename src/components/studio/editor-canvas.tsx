"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { editorMenuStyle, shouldShowSelectionToolbar } from "@/lib/editor/selection-toolbar";
import { CheckSquare, Code2, Copy, GripVertical, List, ListOrdered, Plus, Quote, Trash2, Type } from "lucide-react";
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

type BlockRef = {
  from: number;
  to: number;
  index: number;
  node: NonNullable<ReturnType<Editor["state"]["doc"]["nodeAt"]>>;
};

function topLevelBlocks(editor: Editor): BlockRef[] {
  const blocks: BlockRef[] = [];
  editor.state.doc.forEach((node, offset, index) => {
    blocks.push({ from: offset, to: offset + node.nodeSize, index, node });
  });
  return blocks;
}

function blockAtPosition(editor: Editor, position: number): BlockRef | null {
  return topLevelBlocks(editor).find((block) => position >= block.from && position <= block.to) ?? null;
}

function blockPositionStyle(editor: Editor, block: BlockRef, offset = 0): CSSProperties {
  try {
    const rect = editor.view.coordsAtPos(Math.min(editor.state.doc.content.size, block.from + 1));
    return {
      position: "fixed",
      top: Math.round(rect.top + offset),
      left: Math.max(8, Math.round(rect.left - 72)),
      zIndex: 30,
    };
  } catch {
    return { position: "fixed", top: 120, left: 8, zIndex: 30 };
  }
}

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
  const [hoveredBlock, setHoveredBlock] = useState<BlockRef | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockRef | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockRef[]>([]);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const marqueeRef = useRef<typeof marquee>(null);
  const [, setRenderTick] = useState(0);
  const queryRef = useRef("");
  const dismissedKeyRef = useRef<string | null>(null);
  const items = useMemo(() => filterSlashCommands(slash?.query ?? ""), [slash?.query]);
  const activeIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);
  const slashOpen = Boolean(slash);
  const showToolbar = editor ? shouldShowSelectionToolbar(editor, slashOpen) : false;
  const showInsert = Boolean(editor?.isEditable && !slashOpen && editor && isEmptyParagraphCaret(editor));

  useEffect(() => {
    if (!editor) return undefined;
    const clearSelection = () => {
      setSelectedBlocks([]);
      setBlockMenu(null);
    };
    editor.on("transaction", clearSelection);
    return () => {
      editor.off("transaction", clearSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const elements = Array.from(editor.view.dom.children);
    const selected = new Set(selectedBlocks.map((block) => block.index));
    elements.forEach((element, index) => {
      element.toggleAttribute("data-editor-selected", selected.has(index));
    });
    return () => elements.forEach((element) => element.removeAttribute("data-editor-selected"));
  }, [editor, selectedBlocks]);

  useEffect(() => {
    if (!marquee || !editor) return undefined;
    marqueeRef.current = marquee;
    const onPointerMove = (event: PointerEvent) => {
      const next = { ...marqueeRef.current!, endX: event.clientX, endY: event.clientY };
      marqueeRef.current = next;
      setMarquee(next);
    };
    const onPointerUp = () => {
      const current = marqueeRef.current;
      if (!current) return;
      const left = Math.min(current.startX, current.endX);
      const right = Math.max(current.startX, current.endX);
      const top = Math.min(current.startY, current.endY);
      const bottom = Math.max(current.startY, current.endY);
      const blocks = topLevelBlocks(editor).filter((block) => {
        const element = editor.view.dom.children[block.index] as HTMLElement | undefined;
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom;
      });
      setSelectedBlocks(blocks);
      setMarquee(null);
      marqueeRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [editor, marquee]);

  function applyBlockCommand(command: "paragraph" | "heading" | "bullet" | "ordered" | "task" | "quote" | "code") {
    if (!editor || !blockMenu) return;
    const from = blockMenu.from + 1;
    const to = Math.max(from, blockMenu.to - 1);
    const chain = editor.chain().focus().setTextSelection({ from, to });
    switch (command) {
      case "heading": chain.setHeading({ level: 1 }).run(); break;
      case "bullet": chain.toggleBulletList().run(); break;
      case "ordered": chain.toggleOrderedList().run(); break;
      case "task": chain.toggleTaskList().run(); break;
      case "quote": chain.toggleBlockquote().run(); break;
      case "code": chain.setCodeBlock().run(); break;
      default: chain.setParagraph().run(); break;
    }
    setBlockMenu(null);
  }

  function deleteSelectedBlocks(fallback?: BlockRef | null) {
    if (!editor) return;
    const targets = selectedBlocks.length > 0 ? selectedBlocks : fallback ? [fallback] : [];
    if (targets.length === 0) return;
    const ranges = [...targets].sort((a, b) => b.from - a.from);
    const chain = editor.chain().focus();
    ranges.forEach((block) => chain.deleteRange({ from: block.from, to: block.to }));
    chain.run();
    setSelectedBlocks([]);
  }

  function duplicateBlock(block: BlockRef) {
    if (!editor) return;
    editor.chain().focus().insertContentAt(block.to, block.node.toJSON()).run();
    setBlockMenu(null);
  }

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
    <div
      className="document-editor-canvas"
      onMouseMove={(event) => {
        if (!editor || !editor.isEditable) return;
        const target = event.target as HTMLElement;
        if (target.closest(".editor-block-controls, .editor-block-menu")) return;
        const blockElement = target.closest(".ProseMirror > *") as HTMLElement | null;
        if (!blockElement) {
          setHoveredBlock(null);
          return;
        }
        try {
          setHoveredBlock(blockAtPosition(editor, editor.view.posAtDOM(blockElement, 0)));
        } catch {
          setHoveredBlock(null);
        }
      }}
      onPointerDown={(event) => {
        if (!editor?.isEditable || event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest(".ProseMirror > *, .editor-block-controls, .editor-block-menu")) return;
        const next = { startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY };
        marqueeRef.current = next;
        setMarquee(next);
      }}
    >
      <EditorContent editor={editor} />
      {editor && hoveredBlock && editor.isEditable ? (
        <div
          className="editor-block-controls"
          style={blockPositionStyle(editor, hoveredBlock)}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={t.editor.slashLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              editor.chain().focus().setTextSelection(hoveredBlock.from + 1).insertContent("/").run();
            }}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            aria-label={t.editor.blockMenu}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setBlockMenu(hoveredBlock)}
          >
            <GripVertical size={14} />
          </button>
        </div>
      ) : null}
      {editor && blockMenu && editor.isEditable ? (
        <div className="editor-block-menu" style={blockPositionStyle(editor, blockMenu, 28)} role="menu">
          <div className="editor-block-menu-grid">
            <button type="button" title={t.editor.paragraph} onClick={() => applyBlockCommand("paragraph")}><Type size={15} /></button>
            <button type="button" title={t.editor.heading1} onClick={() => applyBlockCommand("heading")}><Type size={15} /></button>
            <button type="button" title={t.editor.bulletList} onClick={() => applyBlockCommand("bullet")}><List size={15} /></button>
            <button type="button" title={t.editor.orderedList} onClick={() => applyBlockCommand("ordered")}><ListOrdered size={15} /></button>
            <button type="button" title={t.editor.taskList} onClick={() => applyBlockCommand("task")}><CheckSquare size={15} /></button>
            <button type="button" title={t.editor.blockquote} onClick={() => applyBlockCommand("quote")}><Quote size={15} /></button>
            <button type="button" title={t.editor.codeBlock} onClick={() => applyBlockCommand("code")}><Code2 size={15} /></button>
          </div>
          <div className="editor-block-menu-actions">
            <button type="button" role="menuitem" onClick={() => duplicateBlock(blockMenu)}><Copy size={14} />{t.editor.duplicateBlock}</button>
            <button type="button" role="menuitem" onClick={() => deleteSelectedBlocks(blockMenu)}><Trash2 size={14} />{t.editor.deleteBlock}</button>
          </div>
        </div>
      ) : null}
      {editor && selectedBlocks.length > 0 ? (
        <div className="editor-block-selection-toolbar" role="toolbar" style={blockPositionStyle(editor, selectedBlocks[0], -42)}>
          <span>{t.editor.selectedBlocks.replace("{count}", String(selectedBlocks.length))}</span>
          <button type="button" aria-label={t.editor.deleteBlock} onClick={() => deleteSelectedBlocks()}><Trash2 size={14} /></button>
        </div>
      ) : null}
      {marquee ? (
        <div
          className="editor-marquee"
          style={{
            left: Math.min(marquee.startX, marquee.endX),
            top: Math.min(marquee.startY, marquee.endY),
            width: Math.abs(marquee.endX - marquee.startX),
            height: Math.abs(marquee.endY - marquee.startY),
          }}
          aria-hidden="true"
        />
      ) : null}
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
