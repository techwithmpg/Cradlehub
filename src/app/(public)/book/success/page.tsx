import Link from "next/link";
import { CheckCircle, Phone, MapPin, Clock, Calendar, ArrowLeft } from "lucide-react";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export default function BookingSuccessPage() {
  return (
    <div className="sp-public relative min-h-screen overflow-hidden bg-[#071A12] text-[#FAF5E9]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_10%,rgba(28,89,63,0.4),transparent_65%),radial-gradient(600px_340px_at_85%_20%,rgba(212,181,122,0.12),transparent_60%)]" aria-hidden="true" />
      <div className="relative pt-28 pb-24 lg:pt-36 lg:pb-28">
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>
            {/* Success icon */}
            <div className="mb-8 flex justify-center">
              <div className="eg-glass-card flex h-24 w-24 items-center justify-center rounded-full border border-[#D4B57A]/60 bg-[#0A251A]/90 shadow-lg">
                <CheckCircle className="h-12 w-12 text-[#E5C98B]" aria-hidden="true" />
              </div>
            </div>

            {/* Heading */}
            <div className="mb-10 text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                Request Received
              </p>
              <h1
                className="mb-4 text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Your Booking Request Was Received
              </h1>
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-[#CBD6CD]">
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
                  className="eg-glass-card rounded-2xl p-5 text-center"
                >
                  <card.icon className="mx-auto mb-2 h-5 w-5 text-[#E5C98B]" aria-hidden="true" />
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#E5C98B]">
                    {card.title}
                  </p>
                  {"lines" in card &&
                    card.lines?.map((l) => (
                      <p key={l} className="text-[13px] text-[#CBD6CD]">
                        {l}
                      </p>
                    ))}
                  {"links" in card &&
                    card.links?.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        className="block text-[13px] font-medium text-[#FAF5E9] transition-colors hover:text-[#E5C98B]"
                      >
                        {l.label}
                      </a>
                    ))}
                </div>
              ))}
            </div>

            {/* Before your visit */}
            <div className="eg-glass-card mb-10 rounded-2xl p-7">
              <h2 className="mb-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
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
                    <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/40 bg-[#D4B57A]/15">
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#E5C98B]" />
                    </span>
                    <p className="text-[13px] leading-relaxed text-[#CBD6CD]">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-7 text-[13px] font-semibold text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Book Another
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-7 text-[13px] font-semibold text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
              >
                <Phone className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                Call Us
              </a>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-2 px-4 text-[13px] font-medium text-[#CBD6CD] transition-colors hover:text-[#FAF5E9]"
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
