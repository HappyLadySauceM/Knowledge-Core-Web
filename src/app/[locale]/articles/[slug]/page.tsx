import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import type { RichTextNode } from "@/lib/api/types";
import { getMessages } from "@/lib/i18n";
import { getPublishedDocument, getSiteProfile } from "@/lib/site";

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = getMessages(locale);
  const [article, profile] = await Promise.all([getPublishedDocument(slug), getSiteProfile()]);
  if (!article || !article.document.published) notFound();
  const content = Array.isArray(article.content.content) ? article.content.content as RichTextNode[] : [];
  return <article className="article-page container-shell"><Link className="back-link article-back" href={`/${locale}`}><ArrowLeft size={15} />{t.home.backToArticles}</Link><header className="article-header"><p className="article-kicker">{article.document.tags?.[0] ?? profile.title}</p><h1>{article.document.title}</h1><p className="article-summary">{article.document.summary}</p><div className="article-meta">{article.document.owner?.username} · {new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", { dateStyle: "long" }).format(new Date(article.document.published_at ?? article.document.updated_at))}</div></header><RichText content={content} /><footer className="article-footer"><Link href={`/${locale}`}>{t.home.backToArticles} <ArrowUpRight size={15} /></Link></footer></article>;
}
