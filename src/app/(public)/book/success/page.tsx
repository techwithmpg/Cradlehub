import Link from "next/link";
import { CheckCircle, Phone, MapPin, Clock, Calendar, ArrowLeft } from "lucide-react";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export default function BookingSuccessPage() {
  return (
    <div className="sp-public min-h-screen bg-[#F7F3EB] text-[#10261D]">
      <div className="pt-28 pb-24 lg:pt-36 lg:pb-28">
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>
            {/* Success icon */}
            <div className="mb-8 flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#D4B57A] bg-[#10261D] shadow-md">
                <CheckCircle className="h-12 w-12 text-[#D4B57A]" aria-hidden="true" />
              </div>
            </div>

            {/* Heading */}
            <div className="mb-10 text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#8A6D3B]">
                Request Received
              </p>
              <h1
                className="mb-4 text-3xl font-medium leading-tight text-[#10261D] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Your Booking Request Was Received
              </h1>
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-[#35463E]">
                Thank you for choosing Cradle Wellness Living. Our front desk will review
                your request and confirm your appointment details.
              </p>
            </div>

            {/* Info cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Clock,
                  title: "Hours",
                  lines: ["Open Daily", "10:00 AM – 10:00 PM"],
                },
                {
                  icon: MapPin,
                  title: "SM City Branch",
                  lines: ["3rd Floor, North Wing", "SM City Bacolod"],
                },
                {
                  icon: Phone,
                  title: "Questions?",
                  links: [
                    { href: "tel:+639177077070", label: "0917 707 7070" },
                    { href: "tel:+639090087815", label: "0909 008 7815" },
                  ],
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[#E5DEC9] bg-white p-5 text-center shadow-xs"
                >
                  <card.icon className="mx-auto mb-2 h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8A6D3B]">
                    {card.title}
                  </p>
                  {"lines" in card &&
                    card.lines?.map((l) => (
                      <p key={l} className="text-[13px] text-[#35463E]">
                        {l}
                      </p>
                    ))}
                  {"links" in card &&
                    card.links?.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        className="block text-[13px] font-medium text-[#10261D] transition-colors hover:text-[#B68A3C]"
                      >
                        {l.label}
                      </a>
                    ))}
                </div>
              ))}
            </div>

            {/* Before your visit */}
            <div className="mb-10 rounded-2xl border border-[#E5DEC9] bg-white p-7 shadow-xs">
              <h2 className="mb-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8A6D3B]">
                Before Your Visit
              </h2>
              <ul className="flex flex-col gap-3">
                {[
                  "Arrive 10 minutes early to complete a brief wellness intake.",
                  "Wear comfortable clothing — robes and slippers are provided.",
                  "To reschedule or cancel, please call us at least 24 hours in advance.",
                  "Let your therapist know about any health concerns or preferences.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-3">
                    <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#EFE2C2]">
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#8A6D3B]" />
                    </span>
                    <p className="text-[13px] leading-relaxed text-[#35463E]">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#163A2B] px-7 text-[13px] font-semibold text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Book Another
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4CBB3] bg-white px-7 text-[13px] font-semibold text-[#10261D] transition hover:bg-[#FCFAF5]"
              >
                <Phone className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
                Call Us
              </a>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-2 px-4 text-[13px] font-medium text-[#55635B] transition-colors hover:text-[#10261D]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Home
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
