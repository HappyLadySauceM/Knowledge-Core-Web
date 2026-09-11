import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { normalizeLinkHref, shouldShowSelectionToolbar } from "@/lib/editor/selection-toolbar";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";

describe("normalizeLinkHref", () => {
  it("prefixes https when the scheme is omitted", () => {
    expect(normalizeLinkHref("example.com")).toBe("https://example.com");
    expect(normalizeLinkHref("https://example.com")).toBe("https://example.com");
  });
});

describe("shouldShowSelectionToolbar", () => {
  it("hides while a slash menu is open", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createStudioDocumentExtensions(),
      content: "<p>Hello</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(shouldShowSelectionToolbar(editor, true)).toBe(false);
    expect(shouldShowSelectionToolbar(editor, false)).toBe(true);
    editor.destroy();
  });
});
