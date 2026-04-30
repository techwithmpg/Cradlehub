import type { ReactNode } from "react";
import { BookingWizardProvider } from "@/components/public/booking-wizard-provider";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { MobileBookingBar } from "@/components/public/mobile-booking-bar";
import { ContactCta } from "@/components/public/contact-cta";

type PublicSiteShellProps = {
  children: ReactNode;
  showContactCta?: boolean;
};

export function PublicSiteShell({ children, showContactCta = true }: PublicSiteShellProps) {
  return (
    <BookingWizardProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_14%_0%,rgba(255,246,220,0.72),transparent_34%),radial-gradient(circle_at_92%_16%,rgba(231,200,115,0.28),transparent_34%),linear-gradient(180deg,#24180f_0%,#2a1d13_24%,#1c140f_52%,#130d0a_100%)] text-[#f9f2df]">
        <SiteHeader />
        <main className="pb-20 md:pb-0">{children}</main>
        {showContactCta && <ContactCta />}
        <SiteFooter />
        <MobileBookingBar />
      </div>
    </BookingWizardProvider>
  );
}
