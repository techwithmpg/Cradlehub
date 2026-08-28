import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_DOMAIN } from "@/lib/seo/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path }) => ({
    url: `${SITE_DOMAIN}${path}`,
  }));
}
