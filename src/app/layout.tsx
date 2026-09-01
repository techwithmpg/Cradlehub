import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  DM_Sans,
  Manrope,
  Playfair_Display,
} from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { PublicRouteLoadingLine } from "@/components/public/public-route-loading-line";
import {
  BUSINESS_NAME,
  BUSINESS_TAGLINE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_DOMAIN,
} from "@/lib/seo/constants";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/seo/structured-data";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

import {
  getPublishedBrandSettingsCached,
  type PublishedBrandSettings,
} from "@/lib/queries/marketing-brand";

export async function generateMetadata(): Promise<Metadata> {
  let brandSettings: PublishedBrandSettings | null = null;
  try {
    brandSettings = await getPublishedBrandSettingsCached();
  } catch {
    // Fail-closed to static fallback
  }

  const pkg = brandSettings?.siteIconPackage;
  const iconList: { url: string; sizes?: string; type?: string }[] = [];

  if (pkg?.icons?.icon32 || pkg?.icons?.ico) {
    if (pkg.icons.icon16)
      iconList.push({ url: pkg.icons.icon16, sizes: "16x16", type: "image/png" });
    if (pkg.icons.icon32)
      iconList.push({ url: pkg.icons.icon32, sizes: "32x32", type: "image/png" });
    if (pkg.icons.icon48)
      iconList.push({ url: pkg.icons.icon48, sizes: "48x48", type: "image/png" });
    if (pkg.icons.icon192)
      iconList.push({ url: pkg.icons.icon192, sizes: "192x192", type: "image/png" });
    if (pkg.icons.icon512)
      iconList.push({ url: pkg.icons.icon512, sizes: "512x512", type: "image/png" });
    if (pkg.icons.ico) iconList.push({ url: pkg.icons.ico });
  } else {
    iconList.push({ url: "/favicon.ico" });
    iconList.push({ url: "/icon.png", type: "image/png", sizes: "512x512" });
  }

  const appleList: { url: string; sizes?: string; type?: string }[] = [];
  if (pkg?.icons?.apple180) {
    appleList.push({ url: pkg.icons.apple180, sizes: "180x180", type: "image/png" });
  } else {
    appleList.push({ url: "/apple-icon.png", sizes: "180x180", type: "image/png" });
  }

  return {
    metadataBase: new URL(SITE_DOMAIN),
    title: {
      default: `${BUSINESS_NAME} | ${brandSettings?.taglineText || BUSINESS_TAGLINE}`,
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
    openGraph: {
      siteName: BUSINESS_NAME,
      locale: "en_PH",
      type: "website",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          alt: `${BUSINESS_NAME} — Massage and spa services in Bacolod`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${BUSINESS_NAME} | ${brandSettings?.taglineText || BUSINESS_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: SITE_DOMAIN,
    },
    icons: {
      icon: iconList,
      apple: appleList,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} ${cormorant.variable} ${manrope.variable} font-sans antialiased`}>
        {children}
        <PublicRouteLoadingLine />
        <Toaster position="top-right" richColors />
        <SpeedInsights />
      </body>
    </html>
  );
}
