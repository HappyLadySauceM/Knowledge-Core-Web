import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";

const editors: Editor[] = [];

function createEditor(content = "<p>Hello</p>") {
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

describe("createStudioDocumentExtensions", () => {
  it("toggles the underline mark on a text selection", () => {
    const editor = createEditor();
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(editor.chain().focus().toggleUnderline().run()).toBe(true);
    expect(editor.isActive("underline")).toBe(true);
  });

  it("defines the schema top node without collaboration options", () => {
    const editor = createEditor();
    expect(editor.schema.topNodeType.name).toBe("doc");
  });

  it("throws when TipTap is created with an empty extensions array", () => {
    expect(() => new Editor({ extensions: [] })).toThrow(/top node type \('doc'\)/);
  });
});
