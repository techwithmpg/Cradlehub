import Link from "next/link";

export default function ServiceBookingGuidePage() {
  return (
    <main
      className="min-h-screen text-[#F6EBD6]"
      style={{
        background:
          "radial-gradient(circle at 80% 8%, rgba(212,181,122,0.14), transparent 34%), radial-gradient(circle at 12% 18%, rgba(30,61,47,0.38), transparent 38%), linear-gradient(180deg, #031B16 0%, #05241D 45%, #02140F 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-28 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#D4B57A]">
            Cradle Services
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#F6EBD6]">
            Choose your service from the guided booking page.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[#F6EBD6]/72">
            Service availability can vary by branch and visit type. The booking flow will show the options that are ready for your selected appointment.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] px-6 text-sm font-semibold text-[#031B16] shadow-[0_18px_42px_rgba(200,169,106,0.25)]"
            >
              Book Appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#D4B57A]/55 bg-[#031B16]/50 px-6 text-sm font-semibold text-[#F6EBD6] backdrop-blur-md"
            >
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
