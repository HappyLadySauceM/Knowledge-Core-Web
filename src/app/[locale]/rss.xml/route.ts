import { getPublishedDocuments, getSiteProfile } from "@/lib/site";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [profile, documents] = await Promise.all([getSiteProfile(), getPublishedDocuments()]);
  const origin = new URL(request.url).origin;
  const items = documents.items.map((document) => {
    const link = `${origin}/${locale}/articles/${encodeURIComponent(document.slug)}`;
    return `<item><title>${escapeXml(document.title)}</title><link>${link}</link><guid>${link}</guid><description>${escapeXml(document.summary)}</description><pubDate>${new Date(document.published_at ?? document.updated_at).toUTCString()}</pubDate></item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(profile.title)}</title><link>${origin}/${locale}</link><description>${escapeXml(locale === "zh-CN" ? profile.tagline_zh : profile.tagline_en)}</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}
