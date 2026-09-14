import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";
import { EditorCanvas } from "@/components/studio/editor-canvas";
import { shouldShowSelectionToolbar } from "@/lib/editor/selection-toolbar";
import { createStudioDocumentExtensions } from "@/lib/editor/studio-extensions";

afterEach(() => {
  cleanup();
});

function dispatchEditorKey(editor: Editor, key: string) {
  editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

function EditorHarness({
  content = "<p></p>",
  locale = "en",
  onReady,
}: {
  content?: string;
  locale?: string;
  onReady: (editor: Editor) => void;
}) {
  const editor = useEditor({
    extensions: createStudioDocumentExtensions(),
    content,
    onCreate: ({ editor: next }) => onReady(next),
  });
  return <EditorCanvas editor={editor} locale={locale} onRequestLink={() => undefined} />;
}

describe("EditorCanvas slash menu", () => {
  it("opens on /, closes on Escape, and inserts a heading command", async () => {
    let editor: Editor | null = null;
    render(<EditorHarness onReady={(next) => { editor = next; }} />);
    await waitFor(() => expect(editor).toBeTruthy());

    act(() => {
      editor!.commands.insertContent("/");
    });
    const menu = await screen.findByRole("listbox", { name: "Insert block" });
    expect(menu).toBeVisible();
    expect(screen.getByRole("option", { name: "Heading 1" })).toBeVisible();

    act(() => {
      dispatchEditorKey(editor!, "Escape");
    });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    act(() => {
      editor!.commands.clearContent();
      editor!.commands.insertContent("/");
    });
    expect(await screen.findByRole("listbox")).toBeVisible();

    act(() => {
      dispatchEditorKey(editor!, "Enter");
    });
    await waitFor(() => expect(editor!.isActive("heading", { level: 1 })).toBe(true));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("uses zh-CN labels in the slash menu", async () => {
    let editor: Editor | null = null;
    render(<EditorHarness locale="zh-CN" onReady={(next) => { editor = next; }} />);
    await waitFor(() => expect(editor).toBeTruthy());
    act(() => {
      editor!.commands.insertContent("/");
    });
    expect(await screen.findByRole("listbox", { name: "插入块" })).toBeVisible();
    expect(screen.getByRole("option", { name: "一级标题" })).toBeVisible();
  });
});

describe("EditorCanvas selection toolbar", () => {
  // jsdom does not layout ProseMirror, so coordsAtPos is typically 0,0.
  // The toolbar still mounts in the DOM when the selection is non-empty.
  // jsdom 不会给 ProseMirror 做布局，coordsAtPos 通常为 0,0。
  // 选区非空时工具栏仍会挂到 DOM，只是位置不可用于视觉回归。
  it("appears when text is selected and stays hidden for a caret", async () => {
    let editor: Editor | null = null;
    render(
      <EditorHarness
        content="<p>Hello world</p>"
        onReady={(next) => {
          editor = next;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    expect(shouldShowSelectionToolbar(editor!, false)).toBe(false);
    expect(screen.queryByRole("toolbar", { name: "Text formatting" })).toBeNull();

    act(() => {
      editor!.commands.setTextSelection({ from: 1, to: 6 });
    });
    expect(shouldShowSelectionToolbar(editor!, false)).toBe(true);
    expect(await screen.findByRole("toolbar", { name: "Text formatting" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bold" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Link" })).toBeVisible();

    act(() => {
      editor!.commands.setTextSelection(1);
    });
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Text formatting" })).toBeNull());
  });
});
