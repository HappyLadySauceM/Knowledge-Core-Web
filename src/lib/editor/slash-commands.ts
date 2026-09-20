import type { Editor } from "@tiptap/core";

export const SLASH_COMMAND_IDS = [
  "heading1",
  "heading2",
  "heading3",
  "heading4",
  "heading5",
  "heading6",
  "inlineCode",
  "image",
  "videoFile",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "columns",
  "callout",
  "formula",
  "link",
] as const;

export type SlashCommandId = (typeof SLASH_COMMAND_IDS)[number];

export const SLASH_GROUP_IDS = ["basic", "common"] as const;
export type SlashGroupId = (typeof SLASH_GROUP_IDS)[number];

export type SlashCommand = {
  id: SlashCommandId;
  keywords: readonly string[];
};

export type SlashMatch = {
  from: number;
  to: number;
  query: string;
};

export type SlashCommandGroup = {
  id: SlashGroupId;
  items: SlashCommand[];
};

export const SLASH_GROUP_COMMANDS: Record<SlashGroupId, readonly SlashCommandId[]> = {
  basic: ["heading1", "heading2", "heading3", "heading4", "heading5", "heading6", "inlineCode", "bulletList", "orderedList", "taskList"],
  common: ["image", "videoFile", "blockquote", "codeBlock", "horizontalRule", "table", "columns", "callout", "formula", "link"],
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: "heading1", keywords: ["h1", "heading", "title", "标题"] },
  { id: "heading2", keywords: ["h2", "heading", "标题"] },
  { id: "heading3", keywords: ["h3", "heading", "标题"] },
  { id: "heading4", keywords: ["h4", "heading", "标题"] },
  { id: "heading5", keywords: ["h5", "heading", "标题"] },
  { id: "heading6", keywords: ["h6", "heading", "标题"] },
  { id: "inlineCode", keywords: ["inline", "code", "行内", "代码"] },
  { id: "image", keywords: ["image", "picture", "photo", "图片"] },
  { id: "videoFile", keywords: ["video", "file", "attachment", "视频", "文件"] },
  { id: "bulletList", keywords: ["bullet", "ul", "list", "unordered", "列表", "无序"] },
  { id: "orderedList", keywords: ["number", "ol", "list", "ordered", "列表", "有序"] },
  { id: "taskList", keywords: ["todo", "task", "check", "checkbox", "任务"] },
  { id: "blockquote", keywords: ["quote", "blockquote", "引用"] },
  { id: "codeBlock", keywords: ["code", "pre", "代码"] },
  { id: "horizontalRule", keywords: ["divider", "hr", "line", "分割", "分隔"] },
  { id: "table", keywords: ["table", "grid", "表格"] },
  { id: "columns", keywords: ["columns", "column", "分栏"] },
  { id: "callout", keywords: ["callout", "highlight", "高亮", "提示"] },
  { id: "formula", keywords: ["formula", "math", "equation", "公式"] },
  { id: "link", keywords: ["link", "url", "href", "链接"] },
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

// Show the empty-line insert control only in an empty paragraph caret.
// 仅在空段落光标处显示行首插入控件。
export function isEmptyParagraphCaret(editor: Editor): boolean {
  const { selection } = editor.state;
  if (!selection.empty) return false;
  const { $from } = selection;
  if ($from.parent.type.name !== "paragraph") return false;
  if ($from.parent.type.spec.code) return false;
  return $from.parent.content.size === 0;
}

export function openSlashOnEmptyLine(editor: Editor): boolean {
  if (!isEmptyParagraphCaret(editor)) return false;
  return editor.chain().focus().insertContent("/").run();
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

export function groupSlashCommands(items: SlashCommand[]): SlashCommandGroup[] {
  return SLASH_GROUP_IDS.map((id) => ({
    id,
    items: items.filter((item) => SLASH_GROUP_COMMANDS[id].includes(item.id)),
  })).filter((group) => group.items.length > 0);
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
    case "heading4":
      return chain.setHeading({ level: 4 }).run();
    case "heading5":
      return chain.setHeading({ level: 5 }).run();
    case "heading6":
      return chain.setHeading({ level: 6 }).run();
    case "inlineCode":
      return chain.toggleCode().run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return chain.toggleTaskList().run();
    case "image":
    case "videoFile":
      return chain.run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.setCodeBlock().run();
    case "horizontalRule":
      return chain.setHorizontalRule().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "columns":
      return chain.insertContent({
        type: "columns",
        content: [
          { type: "column", content: [{ type: "paragraph" }] },
          { type: "column", content: [{ type: "paragraph" }] },
        ],
      }).run();
    case "callout":
      return chain.insertContent({ type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph" }] }).run();
    case "formula":
      return chain.insertContent({ type: "formula", content: [{ type: "text", text: "x = " }] }).run();
    case "link":
      return chain.run();
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
