import type { Metadata } from "next";
import { PublicNav } from "@/components/features/public/public-nav";
import { PublicFooter } from "@/components/features/public/public-footer";
import "./globals-public.css";

export const metadata: Metadata = {
  title: {
    default: "Cradle Wellness Living | Premium Spa · Bacolod City",
    template: "%s | Cradle Spa",
  },
  description:
    "Where stillness meets renewal. Premium massage and wellness treatments in Bacolod City. " +
    "Swedish, Deep Tissue, Hot Stone, Reflexology, and Salon services. Book instantly online.",
  openGraph: {
    title: "Cradle Wellness Living | Premium Spa · Bacolod City",
    description: "Where stillness meets renewal. Book your session online.",
    type: "website",
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--pw-font-body)",
        backgroundColor: "var(--pw-cream)",
        color: "var(--pw-ink)",
        lineHeight: 1.6,
        minHeight: "100vh",
      }}
    >
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
