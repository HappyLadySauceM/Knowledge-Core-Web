import type { CSSProperties } from "react";
import type { SlashCommand } from "@/lib/editor/slash-commands";
import type { getMessages } from "@/lib/i18n";

type EditorCopy = ReturnType<typeof getMessages>["editor"];

type EditorSlashMenuProps = {
  items: SlashCommand[];
  selectedIndex: number;
  labels: EditorCopy;
  style: CSSProperties;
  onHover: (index: number) => void;
  onSelect: (id: SlashCommand["id"]) => void;
};

function commandLabel(id: SlashCommand["id"], labels: EditorCopy): string {
  return labels[id];
}

export function EditorSlashMenu({
  items,
  selectedIndex,
  labels,
  style,
  onHover,
  onSelect,
}: EditorSlashMenuProps) {
  return (
    <div
      className="editor-slash-menu"
      role="listbox"
      aria-label={labels.slashLabel}
      style={style}
    >
      {items.length === 0 ? (
        <p className="editor-slash-empty">{labels.slashEmpty}</p>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id}
            id={`slash-option-${item.id}`}
            role="option"
            aria-selected={index === selectedIndex}
            className={index === selectedIndex ? "is-active" : undefined}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => {
              // Keep the caret in the editor; click must not steal focus.
              // 保持光标在编辑器内，点击不得抢走焦点。
              event.preventDefault();
              onSelect(item.id);
            }}
          >
            {commandLabel(item.id, labels)}
          </div>
        ))
      )}
    </div>
  );
}
