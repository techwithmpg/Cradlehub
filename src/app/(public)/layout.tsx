import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Cradle Massage & Wellness Spa",
    template: "%s | Cradle Spa",
  },
  description:
    "Luxury massage and wellness treatments in Bacolod City. Swedish, Deep Tissue, Hot Stone, Aromatherapy, and more. Book your session online.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-public">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
