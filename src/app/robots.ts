import type { MetadataRoute } from "next";
import { SITE_DOMAIN } from "@/lib/seo/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/owner",
          "/manager",
          "/crm",
          "/staff-portal",
          "/api",
          "/login",
          "/register",
          "/dashboard",
        ],
      },
    ],
    sitemap: `${SITE_DOMAIN}/sitemap.xml`,
  };
}
