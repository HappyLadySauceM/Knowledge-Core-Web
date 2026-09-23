import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const blockTypes = [
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem",
  "blockquote", "codeBlock", "horizontalRule", "image", "attachment", "table", "tableRow",
  "tableHeader", "tableCell", "callout", "columns", "column", "formula",
];

function blockId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Stable IDs are semantic editor metadata. Existing documents receive IDs in
// one system transaction; the history hash intentionally ignores that first
// normalization pass on the server.
export const StableBlockId = Extension.create({
  name: "stableBlockId",
  addGlobalAttributes() {
    return [{
      types: blockTypes,
      attributes: {
        blockId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-block-id"),
          renderHTML: (attributes) => attributes.blockId ? { "data-block-id": attributes.blockId } : {},
        },
      },
    }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey("stableBlockId"),
      appendTransaction: (transactions, _oldState, newState) => {
        if (!transactions.some((transaction) => transaction.docChanged)) return null;
        const transaction = newState.tr;
        let changed = false;
        newState.doc.descendants((node, position) => {
          if (!blockTypes.includes(node.type.name) || node.attrs.blockId) return;
          transaction.setNodeMarkup(position, undefined, { ...node.attrs, blockId: blockId() });
          changed = true;
        });
        if (!changed) return null;
        transaction.setMeta("addToHistory", false);
        transaction.setMeta("historyNormalization", true);
        return transaction;
      },
    })];
  },
});

