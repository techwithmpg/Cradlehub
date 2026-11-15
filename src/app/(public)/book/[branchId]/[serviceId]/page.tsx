import Link from "next/link";

export default function ServiceBookingGuidePage() {
  return (
    <div className="min-h-[70vh] bg-[#F7F3EB] text-[#10261D]">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-6 py-24 text-center">
        <div className="rounded-3xl border border-[#E5DEC9] bg-white p-8 shadow-xs sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8A6D3B]">
            Cradle Services
          </p>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight text-[#10261D] [font-family:var(--sp-font-display)] sm:text-4xl">
            Choose your service from the guided booking page.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#526058]">
            Service availability can vary by branch and visit type. The booking flow will show the options that are ready for your selected appointment.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#163A2B] px-6 text-sm font-semibold text-[#FAF5E9] shadow-xs transition hover:bg-[#1E4D3A]"
            >
              Book Appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#163A2B]/30 bg-[#FCFAF5] px-6 text-sm font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
            >
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
