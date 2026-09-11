import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySlashCommand,
  filterSlashCommands,
  handleSlashMenuKeydown,
  matchSlashInEditor,
  matchSlashQuery,
} from "@/lib/editor/slash-commands";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";

const editors: Editor[] = [];

function createEditor(content = "<p></p>") {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: createStudioDocumentExtensions(),
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe("matchSlashQuery", () => {
  it("matches a slash query at the start of a textblock", () => {
    expect(matchSlashQuery("/")).toEqual({ leading: 0, query: "" });
    expect(matchSlashQuery("  /h1")).toEqual({ leading: 2, query: "h1" });
  });

  it("ignores slash in the middle of a sentence", () => {
    expect(matchSlashQuery("hello /")).toBeNull();
    expect(matchSlashQuery("/heading extra")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("filters heading commands by alias", () => {
    const ids = filterSlashCommands("h1").map((item) => item.id);
    expect(ids).toContain("heading1");
    expect(ids).not.toContain("table");
  });
});

describe("handleSlashMenuKeydown", () => {
  it("moves, confirms, and closes with arrow / enter / escape", () => {
    const changes: number[] = [];
    let confirmed = 0;
    let closed = 0;
    const context = {
      itemCount: 3,
      selectedIndex: 0,
      onIndexChange: (index: number) => {
        changes.push(index);
        context.selectedIndex = index;
      },
      onConfirm: () => {
        confirmed += 1;
      },
      onClose: () => {
        closed += 1;
      },
    };

    expect(handleSlashMenuKeydown({ key: "ArrowDown", preventDefault() {} }, context)).toBe(true);
    expect(changes).toEqual([1]);
    expect(handleSlashMenuKeydown({ key: "Enter", preventDefault() {} }, context)).toBe(true);
    expect(confirmed).toBe(1);
    expect(handleSlashMenuKeydown({ key: "Escape", preventDefault() {} }, context)).toBe(true);
    expect(closed).toBe(1);
    expect(handleSlashMenuKeydown({ key: "a", preventDefault() {} }, context)).toBe(false);
  });
});

describe("slash command apply", () => {
  it("detects an open slash session in the editor", () => {
    const editor = createEditor();
    editor.commands.insertContent("/");
    expect(matchSlashInEditor(editor)).toEqual({ from: 1, to: 2, query: "" });
    editor.commands.insertContent("h1");
    expect(matchSlashInEditor(editor)?.query).toBe("h1");
  });

  it("inserts a heading from a slash command", () => {
    const editor = createEditor();
    editor.commands.insertContent("/");
    const match = matchSlashInEditor(editor);
    expect(match).not.toBeNull();
    expect(applySlashCommand(editor, match!, "heading1")).toBe(true);
    expect(editor.isActive("heading", { level: 1 })).toBe(true);
    expect(matchSlashInEditor(editor)).toBeNull();
  });

  it("inserts a table from a slash command", () => {
    const editor = createEditor();
    editor.commands.insertContent("/");
    const match = matchSlashInEditor(editor);
    expect(applySlashCommand(editor, match!, "table")).toBe(true);
    expect(editor.isActive("table")).toBe(true);
  });
});
