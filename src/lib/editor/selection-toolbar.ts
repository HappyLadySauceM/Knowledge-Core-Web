import type { Editor } from "@tiptap/core";

export type MenuAnchorStyle = {
  position: "fixed";
  top: number;
  left: number;
  zIndex: number;
};

// Show the floating mark toolbar only for a non-empty text selection.
// 仅在非空文本选区时显示浮动标记工具栏。
export function shouldShowSelectionToolbar(editor: Editor, slashOpen: boolean): boolean {
  if (slashOpen) return false;
  const { empty, from, to } = editor.state.selection;
  return !empty && from !== to;
}

export function editorMenuStyle(editor: Editor, pos: number, placement: "above" | "below"): MenuAnchorStyle {
  const fallback: MenuAnchorStyle = { position: "fixed", top: 96, left: 24, zIndex: 30 };
  try {
    const rect = editor.view.coordsAtPos(pos);
    if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.left === 0)) {
      return fallback;
    }
    if (placement === "below") {
      return { position: "fixed", top: Math.round(rect.bottom + 6), left: Math.round(rect.left), zIndex: 30 };
    }
    return {
      position: "fixed",
      top: Math.max(8, Math.round(rect.top - 44)),
      left: Math.round(rect.left),
      zIndex: 30,
    };
  } catch {
    return fallback;
  }
}

// Accept https URLs as typed; prefix a scheme when the author omitted one.
// 已带协议的 URL 原样使用；作者省略协议时补上 https。
export function normalizeLinkHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
