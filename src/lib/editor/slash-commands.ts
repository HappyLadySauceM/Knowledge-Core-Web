import type { Editor } from "@tiptap/core";

export const SLASH_COMMAND_IDS = [
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
] as const;

export type SlashCommandId = (typeof SLASH_COMMAND_IDS)[number];

export type SlashCommand = {
  id: SlashCommandId;
  keywords: readonly string[];
};

export type SlashMatch = {
  from: number;
  to: number;
  query: string;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: "heading1", keywords: ["h1", "heading", "title", "标题"] },
  { id: "heading2", keywords: ["h2", "heading", "标题"] },
  { id: "heading3", keywords: ["h3", "heading", "标题"] },
  { id: "bulletList", keywords: ["bullet", "ul", "list", "unordered", "列表", "无序"] },
  { id: "orderedList", keywords: ["number", "ol", "list", "ordered", "列表", "有序"] },
  { id: "taskList", keywords: ["todo", "task", "check", "checkbox", "任务"] },
  { id: "blockquote", keywords: ["quote", "blockquote", "引用"] },
  { id: "codeBlock", keywords: ["code", "pre", "代码"] },
  { id: "horizontalRule", keywords: ["divider", "hr", "line", "分割", "分隔"] },
  { id: "table", keywords: ["table", "grid", "表格"] },
];

// Match `/query` only when it is the whole textblock (optional leading whitespace).
// 仅在整个文本块为 `/query`（可有前导空白）时匹配。
export function matchSlashQuery(textBefore: string): { leading: number; query: string } | null {
  const match = textBefore.match(/^(\s*)\/([^\s]*)$/);
  if (!match) return null;
  return { leading: match[1].length, query: match[2] };
}

export function matchSlashInEditor(editor: Editor): SlashMatch | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.parent.type.spec.code) return null;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = matchSlashQuery(textBefore);
  if (!match) return null;
  return {
    from: $from.start() + match.leading,
    to: $from.pos,
    query: match.query,
  };
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter((command) => {
    if (command.id.toLowerCase().includes(normalized)) return true;
    return command.keywords.some((keyword) => {
      const value = keyword.toLowerCase();
      return value.includes(normalized) || normalized.includes(value);
    });
  });
}

export function applySlashCommand(editor: Editor, match: SlashMatch, id: SlashCommandId): boolean {
  const chain = editor.chain().focus().deleteRange({ from: match.from, to: match.to });
  switch (id) {
    case "heading1":
      return chain.setHeading({ level: 1 }).run();
    case "heading2":
      return chain.setHeading({ level: 2 }).run();
    case "heading3":
      return chain.setHeading({ level: 3 }).run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.setCodeBlock().run();
    case "horizontalRule":
      return chain.setHorizontalRule().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
}

type SlashKeyEvent = Pick<KeyboardEvent, "key"> & { preventDefault: () => void };

// Keyboard contract for the slash listbox: arrows, Enter, Escape.
// Slash 列表键盘约定：方向键、Enter、Escape。
export function handleSlashMenuKeydown(
  event: SlashKeyEvent,
  context: {
    itemCount: number;
    selectedIndex: number;
    onIndexChange: (index: number) => void;
    onConfirm: () => void;
    onClose: () => void;
  },
): boolean {
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (context.itemCount > 0) {
        context.onIndexChange((context.selectedIndex + 1) % context.itemCount);
      }
      return true;
    case "ArrowUp":
      event.preventDefault();
      if (context.itemCount > 0) {
        context.onIndexChange((context.selectedIndex - 1 + context.itemCount) % context.itemCount);
      }
      return true;
    case "Enter":
      event.preventDefault();
      if (context.itemCount > 0) context.onConfirm();
      return true;
    case "Escape":
      event.preventDefault();
      context.onClose();
      return true;
    default:
      return false;
  }
}
