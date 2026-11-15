import Link from "next/link";

export default function BranchBookingGuidePage() {
  return (
    <div className="min-h-[70vh] bg-[#F7F3EB] text-[#10261D]">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-6 py-24 text-center">
        <div className="rounded-3xl border border-[#E5DEC9] bg-white p-8 shadow-xs sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8A6D3B]">
            Plan Your Cradle Visit
          </p>
          <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight text-[#10261D] [font-family:var(--sp-font-display)] sm:text-4xl">
            Select your branch inside the booking flow.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#526058]">
            Our guided booking page shows the services and times available for each Cradle branch, including in-spa and Home Service options where offered.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#163A2B] px-6 text-sm font-semibold text-[#FAF5E9] shadow-xs transition hover:bg-[#1E4D3A]"
            >
              Start Booking
            </Link>
            <Link
              href="/branches"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#163A2B]/30 bg-[#FCFAF5] px-6 text-sm font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
            >
              View Branches
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
