import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySlashCommand,
  filterSlashCommands,
  groupSlashCommands,
  handleSlashMenuKeydown,
  isEmptyParagraphCaret,
  matchSlashInEditor,
  matchSlashQuery,
  openSlashOnEmptyLine,
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

describe("groupSlashCommands", () => {
  it("splits the default menu into basic and common groups", () => {
    const groups = groupSlashCommands(filterSlashCommands(""));
    expect(groups.map((group) => group.id)).toEqual(["basic", "common"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "heading1",
      "heading2",
      "heading3",
      "bulletList",
      "orderedList",
      "taskList",
    ]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual([
      "blockquote",
      "codeBlock",
      "horizontalRule",
      "table",
      "link",
    ]);
  });

  it("hides empty groups when the query only matches one side", () => {
    const groups = groupSlashCommands(filterSlashCommands("h1"));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("basic");
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["heading1"]);
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

  it("clears the slash query for a link command", () => {
    const editor = createEditor();
    editor.commands.insertContent("/");
    const match = matchSlashInEditor(editor);
    expect(applySlashCommand(editor, match!, "link")).toBe(true);
    expect(matchSlashInEditor(editor)).toBeNull();
  });
});

describe("empty paragraph insert", () => {
  it("opens slash from an empty paragraph and ignores filled lines", () => {
    const editor = createEditor();
    expect(isEmptyParagraphCaret(editor)).toBe(true);
    expect(openSlashOnEmptyLine(editor)).toBe(true);
    expect(matchSlashInEditor(editor)?.query).toBe("");

    editor.commands.setContent("<p>Hello</p>");
    editor.commands.setTextSelection(2);
    expect(isEmptyParagraphCaret(editor)).toBe(false);
    expect(openSlashOnEmptyLine(editor)).toBe(false);
  });
});
