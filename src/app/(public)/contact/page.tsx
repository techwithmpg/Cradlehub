import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="sp-public">
      {/* Page Header */}
      <div className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: "#F7F3EB" }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Get in Touch
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-5"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            We Would Love to Hear From You
          </h1>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: "#6B7A6F" }}>
            Have questions about our services, availability, or special requests?
            Reach out and our team will respond with care.
          </p>
        </div>
      </div>

      {/* Contact Info */}
      <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Phone,
                title: "Phone",
                lines: ["+63 (34) 123 4567", "+63 917 123 4567"],
              },
              {
                icon: Mail,
                title: "Email",
                lines: ["hello@cradlespa.com", "bookings@cradlespa.com"],
              },
              {
                icon: MapPin,
                title: "Location",
                lines: ["Bacolod City", "Negros Occidental, Philippines"],
              },
              {
                icon: Clock,
                title: "Hours",
                lines: ["Mon – Sat: 9AM – 9PM", "Sunday: 10AM – 6PM"],
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100}>
                <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3
                    className="text-[16px] font-semibold mb-3"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                  >
                    {item.title}
                  </h3>
                  {item.lines.map((line) => (
                    <p key={line} className="text-[13px]" style={{ color: "#6B7A6F" }}>
                      {line}
                    </p>
                  ))}
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Quick Contact Actions */}
          <ScrollReveal>
            <div
              className="mt-16 rounded-2xl p-10 lg:p-14 text-center"
              style={{ background: "#163A2B" }}
            >
              <h2
                className="text-2xl sm:text-3xl font-medium mb-4"
                style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
              >
                Ready to Book?
              </h2>
              <p className="text-[15px] max-w-lg mx-auto mb-8" style={{ color: "rgba(247,243,235,0.7)" }}>
                The fastest way to secure your appointment is through our online booking system.
                It takes less than two minutes.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                    color: "#10261D",
                  }}
                >
                  Book Online
                </Link>
                <a
                  href="tel:+63341234567"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-medium tracking-widest uppercase border transition-all duration-300 hover:bg-white/10"
                  style={{
                    borderColor: "rgba(247,243,235,0.25)",
                    color: "rgba(247,243,235,0.9)",
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call Us
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
