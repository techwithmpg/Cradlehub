import Link from "next/link";
import { EmeraldAtmosphere, EmeraldSectionEyebrow, EG_SURFACE } from "@/components/public/emerald-glass";

export default function ServiceBookingGuidePage() {
  return (
    <div className="sp-public relative min-h-[75vh] overflow-hidden bg-[#071A12] text-[#FAF5E9]">
      <EmeraldAtmosphere subtle />
      <div className="relative mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center px-6 py-24 text-center">
        <div className="eg-glass-card rounded-3xl p-8 sm:p-12">
          <EmeraldSectionEyebrow centered>Cradle Services</EmeraldSectionEyebrow>
          <h1 className={`mt-4 text-3xl sm:text-4xl ${EG_SURFACE.heading}`}>
            Choose your service from the guided booking page.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#CBD6CD]">
            Service availability can vary by branch and visit type. The booking flow will show the options that are ready for your selected appointment.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className={`min-h-11 px-6 text-sm ${EG_SURFACE.goldButton}`}
            >
              Book Appointment
            </Link>
            <Link
              href="/services"
              className={`min-h-11 px-6 text-sm ${EG_SURFACE.ghostButton}`}
            >
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
