import type { Metadata } from "next";
import {
  SITE_DOMAIN,
  BUSINESS_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
  CORE_KEYWORDS,
} from "./constants";

export type PageMetaInput = {
  title: string;
  description?: string;
  path: string;
  ogImage?: string;
  ogImageAlt?: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildMetadata(input: PageMetaInput): Metadata {
  const description = input.description ?? DEFAULT_DESCRIPTION;
  const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
  const ogImageAlt = input.ogImageAlt ?? DEFAULT_OG_IMAGE_ALT;
  const url = `${SITE_DOMAIN}${input.path}`;
  const keywords = input.keywords ?? [...CORE_KEYWORDS];

  return {
    title: input.title,
    description,
    keywords,
    metadataBase: new URL(SITE_DOMAIN),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: input.title,
      description,
      url,
      siteName: BUSINESS_NAME,
      locale: "en_PH",
      type: "website",
      images: [
        {
          url: ogImage,
          alt: ogImageAlt,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function buildTitle(segment: string): string {
  return `${segment} | ${BUSINESS_NAME}`;
}
