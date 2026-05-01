import Link from "next/link";
import { CheckCircle, Phone, MapPin, Clock, Calendar, ArrowLeft } from "lucide-react";
import { ScrollReveal } from "@/components/public/scroll-reveal";

export default function BookingSuccessPage() {
  return (
    <div className="sp-public min-h-screen" style={{ background: "#F7F3EB" }}>
      <div className="pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>

            {/* Success icon */}
            <div className="flex justify-center mb-8">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background: "linear-gradient(135deg, #163A2B, #1D4A35)",
                  boxShadow: "0 12px 40px rgba(22,58,43,0.30)",
                }}
              >
                <CheckCircle className="h-12 w-12" style={{ color: "#C8A96B" }} />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-10">
              <p
                className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ color: "#C8A96B" }}
              >
                All Set
              </p>
              <h1
                className="text-3xl sm:text-4xl font-medium leading-tight mb-5"
                style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
              >
                Your Booking is Confirmed
              </h1>
              <p className="text-[15px] leading-relaxed max-w-md mx-auto" style={{ color: "#6B7A6F" }}>
                Thank you for choosing Cradle Wellness Living. Your appointment is confirmed
                and our team looks forward to welcoming you.
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
                  className="rounded-2xl p-5 text-center"
                  style={{ background: "#FCFAF5", border: "1px solid #EDE4D3" }}
                >
                  <card.icon className="h-5 w-5 mx-auto mb-2" style={{ color: "#C8A96B" }} />
                  <p className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#163A2B" }}>
                    {card.title}
                  </p>
                  {"lines" in card && card.lines?.map((l) => (
                    <p key={l} className="text-[13px]" style={{ color: "#6B7A6F" }}>{l}</p>
                  ))}
                  {"links" in card && card.links?.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="block text-[13px] transition-colors hover:text-[#C8A96B]"
                      style={{ color: "#6B7A6F" }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              ))}
            </div>

            {/* Before your visit */}
            <div className="rounded-2xl p-7 mb-10" style={{ background: "#163A2B" }}>
              <h2
                className="text-[12px] font-semibold tracking-[0.18em] uppercase mb-5"
                style={{ color: "#C8A96B" }}
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
                      style={{ background: "rgba(200,169,107,0.18)" }}
                    >
                      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: "#C8A96B" }} />
                    </span>
                    <p className="text-[13px] leading-relaxed" style={{ color: "rgba(252,250,245,0.72)" }}>
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
                  background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                  color: "#10261D",
                  boxShadow: "0 6px 24px rgba(200,169,107,0.35)",
                }}
              >
                <Calendar className="h-3.5 w-3.5" />
                Book Another
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300"
                style={{ color: "#163A2B", border: "1.5px solid #C8A96B60" }}
              >
                <Phone className="h-3.5 w-3.5" />
                Call Us
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[12px] font-medium tracking-wide transition-colors hover:text-[#163A2B]"
                style={{ color: "#9AA89A" }}
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
