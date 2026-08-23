import Link from "next/link";
import { ArrowDown, ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { getPublishedDocuments, getSiteProfile } from "@/lib/site";

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export default async function Home({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = getMessages(locale);
  const [profile, documents] = await Promise.all([getSiteProfile(), getPublishedDocuments(q)]);
  const featured = documents.items[0];
  const rest = documents.items.slice(featured ? 1 : 0);
  const tagline = locale === "zh-CN" ? profile.tagline_zh : profile.tagline_en;
  return <div className="editorial-home">
    <section className="home-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(9, 16, 22, .12), rgba(9, 16, 22, .65)), url(${profile.hero_image_url})`, backgroundPosition: `${profile.hero_focal_x}% ${profile.hero_focal_y}%` }}>
      <div className="home-hero-content container-shell"><p className="hero-brand">{profile.title}</p><h1>{tagline}</h1><p className="hero-hint">{t.home.heroHint}</p><a className="hero-scroll" href="#articles"><span>{t.home.scroll}</span><ArrowDown size={18} /></a></div>
    </section>
    <section id="articles" className="articles-shell container-shell">
      <div className="articles-heading"><div><p className="eyebrow">{t.home.articlesEyebrow}</p><h2>{t.home.articlesTitle}</h2></div><form className="article-search" action={`/${locale}`}><Search size={16} /><input name="q" defaultValue={q} placeholder={t.home.searchPlaceholder} aria-label={t.home.searchPlaceholder} /><button type="submit">{t.home.search}</button></form></div>
      {featured ? <Link href={`/${locale}/articles/${featured.slug}`} className="featured-article"><div><p className="article-kicker">{featured.tags?.[0] ?? t.home.featured}</p><h3>{featured.title}</h3><p>{featured.summary || t.home.readMore}</p><span className="article-meta">{featured.owner?.username} · {formatDate(featured.published_at ?? featured.updated_at, locale)} <ArrowUpRight size={16} /></span></div><div className="featured-art" aria-hidden="true" /></Link> : null}
      {rest.length > 0 ? <div className="article-grid">{rest.map((document) => <Link key={document.id} href={`/${locale}/articles/${document.slug}`} className="article-card"><p className="article-kicker">{document.tags?.[0] ?? t.home.article}</p><h3>{document.title}</h3><p>{document.summary || t.home.readMore}</p><span className="article-meta">{formatDate(document.published_at ?? document.updated_at, locale)} <ArrowUpRight size={15} /></span></Link>)}</div> : null}
      {!featured ? <div className="articles-empty"><p className="eyebrow">{t.home.emptyEyebrow}</p><h3>{t.home.emptyTitle}</h3><p>{t.home.emptyBody}</p><Button asChild variant="secondary"><Link href={`/${locale}/login`}>{t.nav.signIn}</Link></Button></div> : null}
    </section>
  </div>;
}
