import type { CSSProperties } from "react";
import type { Editor } from "@tiptap/core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import type { getMessages } from "@/lib/i18n";

type EditorCopy = ReturnType<typeof getMessages>["editor"];

type EditorSelectionToolbarProps = {
  editor: Editor;
  labels: EditorCopy;
  style: CSSProperties;
  onRequestLink: () => void;
};

export function EditorSelectionToolbar({
  editor,
  labels,
  style,
  onRequestLink,
}: EditorSelectionToolbarProps) {
  return (
    <div className="editor-selection-toolbar" role="toolbar" aria-label={labels.selectionToolbar} style={style}>
      <button
        type="button"
        aria-label={labels.bold}
        aria-pressed={editor.isActive("bold")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.italic}
        aria-pressed={editor.isActive("italic")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.underline}
        aria-pressed={editor.isActive("underline")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.strike}
        aria-pressed={editor.isActive("strike")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.link}
        aria-pressed={editor.isActive("link")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRequestLink}
      >
        <Link size={15} />
      </button>
      <span className="editor-selection-toolbar-sep" aria-hidden="true" />
      <button
        type="button"
        aria-label={labels.alignLeft}
        aria-pressed={editor.isActive({ textAlign: "left" })}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.alignCenter}
        aria-pressed={editor.isActive({ textAlign: "center" })}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter size={15} />
      </button>
      <button
        type="button"
        aria-label={labels.alignRight}
        aria-pressed={editor.isActive({ textAlign: "right" })}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight size={15} />
      </button>
    </div>
  );
}
