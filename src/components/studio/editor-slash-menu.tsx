import type { CSSProperties } from "react";
import type { SlashCommand, SlashCommandGroup } from "@/lib/editor/slash-commands";
import { groupSlashCommands } from "@/lib/editor/slash-commands";
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

function groupLabel(id: SlashCommandGroup["id"], labels: EditorCopy): string {
  return id === "basic" ? labels.slashBasic : labels.slashCommon;
}

export function EditorSlashMenu({
  items,
  selectedIndex,
  labels,
  style,
  onHover,
  onSelect,
}: EditorSlashMenuProps) {
  const groups = groupSlashCommands(items);
  let optionIndex = -1;
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
        groups.map((group) => (
          <div key={group.id} className="editor-slash-group">
            <p className="editor-slash-group-label">{groupLabel(group.id, labels)}</p>
            {group.items.map((item) => {
              optionIndex += 1;
              const index = optionIndex;
              return (
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
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
