import { gatewayFetch } from "@/lib/api/gateway";
import type { DocumentDetail, DocumentPage, SiteProfile } from "@/lib/api/types";

export const fallbackSiteProfile: SiteProfile = {
  title: "HappyLadySauce",
  tagline_zh: "把值得留下的想法，写成值得阅读的文章。",
  tagline_en: "Turn ideas worth keeping into pages worth reading.",
  hero_image_url: "/images/home-hero.png",
  hero_focal_x: 50,
  hero_focal_y: 50,
  revision: 0,
};

export async function getSiteProfile(): Promise<SiteProfile> {
  try {
    const profile = await gatewayFetch<SiteProfile>("/api/v1/site-profile");
    const heroImage = profile.hero_image_url?.startsWith("/") || /^https?:\/\//.test(profile.hero_image_url ?? "") ? profile.hero_image_url : fallbackSiteProfile.hero_image_url;
    return { ...fallbackSiteProfile, ...profile, hero_image_url: heroImage || fallbackSiteProfile.hero_image_url };
  } catch {
    return fallbackSiteProfile;
  }
}

export async function getPublishedDocuments(query?: string): Promise<DocumentPage> {
  const params = new URLSearchParams({ limit: "12" });
  if (query?.trim()) params.set("q", query.trim());
  try {
    return await gatewayFetch<DocumentPage>(`/api/v1/documents?${params.toString()}`);
  } catch {
    return { items: [], page: { has_more: false } };
  }
}

export async function getPublishedDocument(slug: string): Promise<DocumentDetail | null> {
  try {
    return await gatewayFetch<DocumentDetail>(`/api/v1/documents/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}
