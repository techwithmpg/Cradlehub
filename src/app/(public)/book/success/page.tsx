import Link from "next/link";
import { CheckCircle, Phone, MapPin, Clock, Calendar, ArrowLeft } from "lucide-react";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export default function BookingSuccessPage() {
  return (
    <div
      className="sp-public min-h-screen text-[#F6EBD6]"
      style={{
        background:
          "radial-gradient(circle at 80% 8%, rgba(212,181,122,0.14), transparent 34%), radial-gradient(circle at 12% 18%, rgba(30,61,47,0.38), transparent 38%), linear-gradient(180deg, #031B16 0%, #05241D 45%, #02140F 100%)",
      }}
    >
      <div className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>

            {/* Success icon */}
            <div className="flex justify-center mb-8">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background: "rgba(13,43,32,0.72)",
                  border: "1px solid rgba(212,181,122,0.40)",
                  boxShadow: "0 20px 54px rgba(0,0,0,0.32)",
                }}
              >
                <CheckCircle className="h-12 w-12" style={{ color: "#D4B57A" }} />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-10">
              <p
                className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ color: "#D4B57A" }}
              >
                Request Received
              </p>
              <h1
                className="text-3xl sm:text-4xl font-medium leading-tight mb-5"
                style={{ fontFamily: "var(--sp-font-display)", color: "#F6EBD6" }}
              >
                Your Booking Request Was Received
              </h1>
              <p className="text-[15px] leading-relaxed max-w-md mx-auto" style={{ color: "rgba(246,235,214,0.72)" }}>
                Thank you for choosing Cradle Wellness Living. Our front desk will review
                your request and confirm your appointment details.
              </p>
            </div>

            {/* Info cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-10">
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
                  className="rounded-2xl p-5 text-center backdrop-blur-xl"
                  style={{
                    background: "rgba(13,43,32,0.65)",
                    border: "1px solid rgba(212,181,122,0.25)",
                    boxShadow: "0 24px 70px rgba(0,0,0,0.35), inset 0 1px 0 rgba(246,235,214,0.06)",
                  }}
                >
                  <card.icon className="h-5 w-5 mx-auto mb-2" style={{ color: "#D4B57A" }} />
                  <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#D4B57A" }}>
                    {card.title}
                  </p>
                  {"lines" in card && card.lines?.map((l) => (
                    <p key={l} className="text-[13px]" style={{ color: "rgba(246,235,214,0.72)" }}>{l}</p>
                  ))}
                  {"links" in card && card.links?.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="block text-[13px] transition-colors hover:text-[#D4B57A]"
                      style={{ color: "rgba(246,235,214,0.72)" }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              ))}
            </div>

            {/* Before your visit */}
            <div
              className="rounded-2xl p-7 mb-10 backdrop-blur-xl"
              style={{
                background: "rgba(13,43,32,0.65)",
                border: "1px solid rgba(212,181,122,0.25)",
                boxShadow: "0 24px 70px rgba(0,0,0,0.35), inset 0 1px 0 rgba(246,235,214,0.06)",
              }}
            >
              <h2
                className="text-[12px] font-semibold tracking-[0.18em] uppercase mb-5"
                style={{ color: "#D4B57A" }}
              >
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
                    <span
                      className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(212,181,122,0.18)" }}
                    >
                      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "#D4B57A" }} />
                    </span>
                    <p className="text-[13px] leading-relaxed" style={{ color: "rgba(246,235,214,0.72)" }}>
                      {tip}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/book"
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(90deg, #D4B57A, #C8A96A, #B88945)",
                  color: "#031B16",
                  boxShadow: "0 18px 42px rgba(200,169,106,0.25)",
                }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Book Another
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300"
                style={{
                  color: "#F6EBD6",
                  border: "1px solid rgba(212,181,122,0.55)",
                  background: "rgba(3,27,22,0.50)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Phone className="h-3.5 w-3.5" />
                Call Us
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[12px] font-medium tracking-wide transition-colors hover:text-[#D4B57A]"
                style={{ color: "rgba(246,235,214,0.62)" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Home
              </Link>
            </div>

          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
