import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";

export const metadata: Metadata = {
  title: {
    default: "Cradle Massage & Wellness Spa",
    template: "%s | Cradle Spa",
  },
  description:
    "Cradle Massage & Wellness Spa in Bacolod offers massage and wellness services with in-spa and home-service booking support through CradleHub.",
  keywords: [
    "Cradle Massage & Wellness Spa",
    "CradleHub",
    "Bacolod massage",
    "wellness spa Bacolod",
    "in-spa booking",
    "home service massage",
  ],
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-public">
      <SiteHeader />
      {/* pb-20 md:pb-0 — space for mobile bottom nav on small screens */}
      <main className="pb-20 md:pb-0">{children}</main>
      <SiteFooter />
      <PublicBottomNav />
    </div>
  );
}
