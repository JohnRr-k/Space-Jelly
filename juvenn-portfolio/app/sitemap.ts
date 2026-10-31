import type { MetadataRoute } from "next";
import { projects } from "@/lib/content";
import { site } from "@/lib/site";

export const dynamic = "force-static";

// Absolute URLs require a real domain. Set NEXT_PUBLIC_SITE_URL at build time; until then the sitemap is empty.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.url) return [];
  return [{ url: `${site.url}/` }, ...projects.map((p) => ({ url: `${site.url}/work/${p.slug}/` }))];
}
