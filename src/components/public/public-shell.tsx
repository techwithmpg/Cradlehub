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
    <div className="sp-public flex min-h-dvh flex-col bg-[#071A12] text-[#FAF5E9]">
      <BoutiqueCartProvider branchNames={branchNames}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-[#D4B57A] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#071A12]"
        >
          Skip to main content
        </a>
        <MobileFirstVisitPreloader initiallyVisible={!hasSeenMobilePreloader} />
        {withOfflineBanner && <OfflineBanner />}
        <SiteHeader
          primaryPhone={resolvedPhone}
          logoUrl={headerLogoUrl}
          logoAlt={headerLogoAlt}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 pb-20 focus:outline-none lg:pb-0">
          {children}
        </main>
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
