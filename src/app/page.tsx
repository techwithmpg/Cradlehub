import type { Metadata } from "next";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { HomePageSections } from "@/components/public/home-page-sections";
import { PublicMobileHome } from "@/components/public/mobile/public-mobile-home";

export const metadata: Metadata = {
  title:
    "Cradle Massage & Wellness Spa Bacolod | In-Spa & Home Service Booking",
  description:
    "Premium massage and wellness booking in Bacolod for Cradle Massage & Wellness Spa, with in-spa treatments, home service, branch selection, and front-desk support.",
  keywords: [
    "Cradle Massage & Wellness Spa",
    "CradleHub",
    "Bacolod massage",
    "Bacolod wellness spa",
    "home service massage Bacolod",
    "in-spa booking Bacolod",
  ],
  openGraph: {
    title: "Cradle Massage & Wellness Spa Bacolod",
    description:
      "Book calming in-spa and home-service massage treatments in Bacolod.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="sp-public">
      <SiteHeader />
      <main className="pb-20 md:pb-0">
        <PublicMobileHome />
        <div className="hidden md:block">
          <HomePageSections />
        </div>
      </main>
      <SiteFooter />
      <PublicBottomNav />
    </div>
  );
}
