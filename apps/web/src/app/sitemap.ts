import type { MetadataRoute } from "next";
import { getCatalog, getPosts } from "@/server/content";
import { siteUrl } from "@/lib/site-url";

// Every public page in both languages, linked as alternates (hreflang). Articles are Persian only.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const both = (path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path === "/" ? "" : path}` || base,
    alternates: { languages: { fa: `${base}${path === "/" ? "" : path}`, en: `${base}/en${path === "/" ? "" : path}` } },
    ...extra,
  });
  const [{ courses }, posts] = await Promise.all([getCatalog(), getPosts()]);
  return [
    both("/", { changeFrequency: "weekly", priority: 1 }),
    both("/courses", { changeFrequency: "weekly", priority: 0.9 }),
    ...courses.map((c) => both(`/courses/${c.slug}`, { lastModified: c.updatedAt, changeFrequency: "monthly", priority: 0.8 })),
    both("/achievements", { changeFrequency: "monthly", priority: 0.6 }),
    both("/book", { changeFrequency: "monthly", priority: 0.7 }),
    both("/blog", { changeFrequency: "weekly", priority: 0.6 }),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.publishedAt ?? undefined, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
