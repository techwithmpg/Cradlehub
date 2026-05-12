import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_DOMAIN),
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
    title: `${BUSINESS_NAME} | ${BUSINESS_TAGLINE}`,
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
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

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
      <body className={`${dmSans.variable} ${playfair.variable} ${cormorant.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors />
        <SpeedInsights />
      </body>
    </html>
  );
}
