import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { getPublicBranchesCached } from "@/lib/queries/branches";
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
  const branches = await getPublicBranchesCached();
  const primaryPhone = branches[0]?.phone
    ? { label: branches[0].phone, href: `tel:${branches[0].phone.replace(/\s/g, "")}` }
    : undefined;

  return (
    <div className="sp-public">
      <OfflineBanner />
      <SiteHeader primaryPhone={primaryPhone} />
      <main>{children}</main>
      <SiteFooter branches={branches} />
    </div>
  );
}
