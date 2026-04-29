import type { Metadata } from "next";
import { PublicNav } from "@/components/features/public/public-nav";
import { PublicFooter } from "@/components/features/public/public-footer";

export const metadata: Metadata = {
  title: {
    default: "Cradle Massage & Wellness Spa | Bacolod City",
    template: "%s | Cradle Spa",
  },
  description:
    "Premium massage and wellness services in Bacolod City. Swedish, Deep Tissue, Hot Stone, Reflexology, and more. Book online — confirmed instantly.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--ch-page-bg)" }}>
      <PublicNav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem" }}>{children}</main>
      <PublicFooter />
    </div>
  );
}
