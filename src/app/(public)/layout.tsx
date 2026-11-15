import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicBranchesCached } from "@/lib/queries/branches";
import { getPublishedBrandSettingsCached } from "@/lib/queries/marketing-brand";
import { MOBILE_PRELOADER_COOKIE } from "@/lib/public/mobile-preloader";
import {
  BUSINESS_NAME,
  BUSINESS_TAGLINE,
  DEFAULT_DESCRIPTION,
  SITE_DOMAIN,
} from "@/lib/seo/constants";

export const metadata: Metadata = {
  title: {
    default: `${BUSINESS_NAME} | ${BUSINESS_TAGLINE}`,
    template: `%s | ${BUSINESS_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "Cradle Wellness Living",
    "Cradle Massage and Wellness Spa",
    "massage spa Bacolod",
    "wellness spa Bacolod",
    "home service massage Bacolod",
    "book massage Bacolod",
    "spa services Bacolod",
    "Bacolod massage",
    "Bacolod wellness spa",
    "in-spa booking Bacolod",
    "home service massage",
  ],
  metadataBase: new URL(SITE_DOMAIN),
  openGraph: {
    siteName: BUSINESS_NAME,
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [branches, brand, cookieStore] = await Promise.all([
    getPublicBranchesCached(),
    getPublishedBrandSettingsCached(),
    cookies(),
  ]);
  const hasSeenMobilePreloader = cookieStore.get(MOBILE_PRELOADER_COOKIE)?.value === "1";
  const primaryPhone = branches[0]?.phone
    ? { label: branches[0].phone, href: `tel:${branches[0].phone.replace(/\s/g, "")}` }
    : undefined;

  return (
    <PublicShell
      branches={branches}
      hasSeenMobilePreloader={hasSeenMobilePreloader}
      primaryPhone={primaryPhone}
      headerLogoUrl={brand.headerLogoUrl}
      headerLogoAlt={brand.headerLogoAlt}
      footerLogoUrl={brand.footerLogoUrl}
      footerLogoAlt={brand.footerLogoAlt}
      taglineText={brand.taglineText}
      withOfflineBanner
    >
      {children}
    </PublicShell>
  );
}
