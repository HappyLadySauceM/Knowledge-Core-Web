/* eslint-disable @next/next/no-img-element -- attachment URLs are short-lived redirects and cannot use the static Next image loader. */
import type { RichTextNode } from "@/lib/api/types";
import type { ElementType } from "react";

function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/")) return value;
  try { const url = new URL(value); return ["http:", "https:", "mailto:"].includes(url.protocol) ? value : undefined; } catch { return undefined; }
}

function renderNode(node: RichTextNode, index: number): React.ReactNode {
  const children = node.content?.map((child, childIndex) => renderNode(child, childIndex));
  const text = node.text ?? children;
  const attrs = node.attrs ?? {};
  if (node.type === "text") return (node.marks ?? []).reduce<React.ReactNode>((value, mark) => {
    if (mark.type === "link") { const href = safeHref(mark.attrs?.href); return href ? <a key={`${index}-link`} href={href} target="_blank" rel="noreferrer">{value}</a> : value; }
    if (mark.type === "bold") return <strong key={`${index}-bold`}>{value}</strong>;
    if (mark.type === "italic") return <em key={`${index}-italic`}>{value}</em>;
    if (mark.type === "strike") return <s key={`${index}-strike`}>{value}</s>;
    if (mark.type === "underline") return <u key={`${index}-underline`}>{value}</u>;
    if (mark.type === "code") return <code key={`${index}-code`}>{value}</code>;
    return value;
  }, text);
  const key = `${node.type}-${index}`;
  if (node.type === "paragraph") {
    const empty = !node.text && (!node.content || node.content.length === 0);
    return <p key={key} className={empty ? "rich-text-empty-paragraph" : undefined}>{empty ? <br aria-hidden="true" /> : text}</p>;
  }
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
    const Heading = `h${level}` as ElementType;
    return <Heading key={key}>{text}</Heading>;
  }
  if (node.type === "blockquote") return <blockquote key={key}>{text}</blockquote>;
  if (node.type === "codeBlock") return <pre key={key}><code>{text}</code></pre>;
  if (node.type === "bulletList" || node.type === "taskList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
  if (node.type === "listItem" || node.type === "taskItem") return <li key={key}>{text}</li>;
  if (node.type === "horizontalRule") return <hr key={key} />;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "image") {
    const attachmentId = typeof attrs.attachmentId === "string" ? attrs.attachmentId : undefined;
    const src = attachmentId ? `/api/bff/gateway/api/v1/attachments/${encodeURIComponent(attachmentId)}/content` : undefined;
    return src ? <img key={key} src={src} alt={typeof attrs.alt === "string" ? attrs.alt : ""} loading="lazy" /> : null;
  }
  if (node.type === "attachment") {
    const attachmentId = typeof attrs.attachmentId === "string" ? attrs.attachmentId : undefined;
    const href = attachmentId ? `/api/bff/gateway/api/v1/attachments/${encodeURIComponent(attachmentId)}/content` : undefined;
    return href ? <a key={key} className="rich-text-attachment" href={href} target="_blank" rel="noreferrer">{typeof attrs.title === "string" ? attrs.title : "Attachment"}</a> : null;
  }
  if (node.type === "callout") return <aside key={key} className={`rich-text-callout ${typeof attrs.variant === "string" ? attrs.variant : "info"}`}>{children}</aside>;
  if (node.type === "columns") return <div key={key} className="rich-text-columns">{children}</div>;
  if (node.type === "column") return <div key={key} className="rich-text-column">{children}</div>;
  if (node.type === "formula") return <div key={key} className="rich-text-formula" role="math">{text}</div>;
  if (node.type === "table") return <table key={key}><tbody>{children}</tbody></table>;
  if (node.type === "tableRow") return <tr key={key}>{children}</tr>;
  if (node.type === "tableHeader") return <th key={key}>{text}</th>;
  if (node.type === "tableCell") return <td key={key}>{text}</td>;
  return <p key={key}>{text}</p>;
}

export function RichText({ content }: { content: RichTextNode[] }) {
  return <div className="rich-text">{content.map((node, index) => renderNode(node, index))}</div>;
}
