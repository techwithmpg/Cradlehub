import type { MetadataRoute } from "next";
import { SITE_DOMAIN } from "@/lib/seo/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_DOMAIN}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_DOMAIN}/services`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_DOMAIN}/book`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_DOMAIN}/branches`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_DOMAIN}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_DOMAIN}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_DOMAIN}/products`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_DOMAIN}/home-service-massage-bacolod`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_DOMAIN}/massage-spa-bacolod`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
  ];
}
