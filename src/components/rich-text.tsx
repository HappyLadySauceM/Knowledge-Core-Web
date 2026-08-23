import type { RichTextNode } from "@/lib/api/types";

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
    if (mark.type === "code") return <code key={`${index}-code`}>{value}</code>;
    return value;
  }, text);
  const key = `${node.type}-${index}`;
  if (node.type === "heading") return node.attrs?.level === 1 ? <h1 key={key}>{text}</h1> : <h2 key={key}>{text}</h2>;
  if (node.type === "blockquote") return <blockquote key={key}>{text}</blockquote>;
  if (node.type === "codeBlock") return <pre key={key}><code>{text}</code></pre>;
  if (node.type === "bulletList" || node.type === "taskList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
  if (node.type === "listItem" || node.type === "taskItem") return <li key={key}>{text}</li>;
  if (node.type === "horizontalRule") return <hr key={key} />;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "image") { const src = safeHref(attrs.src); return src ? <img key={key} src={src} alt={typeof attrs.alt === "string" ? attrs.alt : ""} loading="lazy" /> : null; }
  return <p key={key}>{text}</p>;
}

export function RichText({ content }: { content: RichTextNode[] }) { return <div className="rich-text">{content.map((node, index) => renderNode(node, index))}</div>; }
