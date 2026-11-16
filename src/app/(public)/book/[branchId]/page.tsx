import Link from "next/link";
import { EmeraldAtmosphere, EmeraldSectionEyebrow, EG_SURFACE } from "@/components/public/emerald-glass";

export default function BranchBookingGuidePage() {
  return (
    <div className="sp-public relative min-h-[75vh] overflow-hidden bg-[#071A12] text-[#FAF5E9]">
      <EmeraldAtmosphere subtle />
      <div className="relative mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center px-6 py-24 text-center">
        <div className="eg-glass-card rounded-3xl p-8 sm:p-12">
          <EmeraldSectionEyebrow centered>Plan Your Cradle Visit</EmeraldSectionEyebrow>
          <h1 className={`mt-4 text-3xl sm:text-4xl ${EG_SURFACE.heading}`}>
            Select your branch inside the booking flow.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#CBD6CD]">
            Our guided booking page shows the services and times available for each Cradle branch, including in-spa and Home Service options where offered.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className={`min-h-11 px-6 text-sm ${EG_SURFACE.goldButton}`}
            >
              Start Booking
            </Link>
            <Link
              href="/branches"
              className={`min-h-11 px-6 text-sm ${EG_SURFACE.ghostButton}`}
            >
              View Branches
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
