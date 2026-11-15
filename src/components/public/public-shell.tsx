import React from "react";
import { BoutiqueCartProvider } from "@/components/public/boutique-cart-context";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { MobileFirstVisitPreloader } from "@/components/shared/mobile-first-visit-preloader";
import { OfflineBanner } from "@/components/shared/offline-banner";
import type { PublicBranch } from "@/lib/public/public-site-data";

type PrimaryPhoneInput = string | { label: string; href: string } | null | undefined;

function normalizePrimaryPhone(input: PrimaryPhoneInput): string | null {
  if (!input) return null;
  if (typeof input === "string") return input;
  return input.label || null;
}

type PublicShellProps = {
  children: React.ReactNode;
  branches: PublicBranch[];
  hasSeenMobilePreloader: boolean;
  primaryPhone?: PrimaryPhoneInput;
  headerLogoUrl?: string | null;
  headerLogoAlt?: string | null;
  footerLogoUrl?: string | null;
  footerLogoAlt?: string | null;
  taglineText?: string | null;
  withOfflineBanner?: boolean;
};

export function PublicShell({
  children,
  branches,
  hasSeenMobilePreloader,
  primaryPhone,
  headerLogoUrl,
  headerLogoAlt,
  footerLogoUrl,
  footerLogoAlt,
  taglineText,
  withOfflineBanner = false,
}: PublicShellProps) {
  const resolvedPhone =
    normalizePrimaryPhone(primaryPhone) ??
    branches.find((b) => Boolean(b.phone))?.phone ??
    null;
  const branchNames = branches.map((b) => b.name);

  return (
    <div className="sp-public flex min-h-dvh flex-col bg-[#F7F3EB] text-[#10261D]">
      <BoutiqueCartProvider branchNames={branchNames}>
        <MobileFirstVisitPreloader initiallyVisible={!hasSeenMobilePreloader} />
        {withOfflineBanner && <OfflineBanner />}
        <SiteHeader
          primaryPhone={resolvedPhone}
          logoUrl={headerLogoUrl}
          logoAlt={headerLogoAlt}
        />
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <SiteFooter
          branches={branches}
          logoUrl={footerLogoUrl}
          logoAlt={footerLogoAlt}
          taglineText={taglineText}
        />
        <PublicBottomNav />
      </BoutiqueCartProvider>
    </div>
  );
}
