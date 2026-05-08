import Link from "next/link";

export default function BookingConfirmationGuidePage() {
  return (
    <main className="min-h-screen bg-[#FCFAF5] text-[#163A2B]">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-28 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#B68A3C]">
            Cradle Booking
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Your appointment starts with the guided booking flow.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[#6B7A6F]">
            Choose your branch, visit type, service, schedule, and therapist so the Cradle team can prepare your visit with care.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#163A2B] px-6 text-sm font-semibold text-[#FCFAF5]"
            >
              Book Appointment
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#C8A96B] px-6 text-sm font-semibold text-[#163A2B]"
            >
              Contact Front Desk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
