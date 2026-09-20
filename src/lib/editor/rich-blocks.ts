import { mergeAttributes, Node } from "@tiptap/core";

const attachmentContentUrl = (id: string) => `/api/bff/gateway/api/v1/attachments/${encodeURIComponent(id)}/content`;

export const StudioImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: { default: null },
      alt: { default: "" },
      title: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-attachment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const id = typeof HTMLAttributes.attachmentId === "string" ? HTMLAttributes.attachmentId : "";
    return ["img", mergeAttributes(HTMLAttributes, {
      src: id ? attachmentContentUrl(id) : undefined,
      "data-attachment-id": id,
      loading: "lazy",
    })];
  },
});

export const StudioAttachment = Node.create({
  name: "attachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: { default: null },
      title: { default: "File" },
    };
  },
  parseHTML() {
    return [{ tag: "a[data-attachment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const id = typeof HTMLAttributes.attachmentId === "string" ? HTMLAttributes.attachmentId : "";
    return ["a", mergeAttributes(HTMLAttributes, {
      href: id ? attachmentContentUrl(id) : undefined,
      "data-attachment-id": id,
      target: "_blank",
      rel: "noreferrer",
    }), HTMLAttributes.title ?? "File"];
  },
});

export const StudioCallout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { variant: { default: "info" } };
  },
  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-callout": HTMLAttributes.variant }), 0];
  },
});

export const StudioColumns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,4}",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-columns": "" }), 0];
  },
});

export const StudioColumn = Node.create({
  name: "column",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-column]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-column": "" }), 0];
  },
});

export const StudioFormula = Node.create({
  name: "formula",
  group: "block",
  content: "text*",
  defining: true,
  code: true,
  parseHTML() {
    return [{ tag: "div[data-formula]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-formula": "", role: "math" }), 0];
  },
});
