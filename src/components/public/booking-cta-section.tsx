import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";
import { Phone, MessageCircle } from "lucide-react";

export function BookingCtaSection() {
  return (
    <section className="py-24 lg:py-32" style={{ background: "#FCFAF5" }}>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <ScrollReveal>
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Reserve Your Session
          </p>
          <h2
            className="text-3xl sm:text-4xl font-medium leading-tight mb-5"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            Begin Your Journey to Wellness
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: "#6B7A6F" }}
          >
            Booking is simple and takes less than two minutes. Choose your preferred treatment,
            select a time that works for you, and arrive ready to unwind.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <Link
              href="/book"
              className="inline-flex items-center rounded-full px-10 py-4 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                color: "#10261D",
                boxShadow: "0 6px 24px rgba(200,169,107,0.45)",
              }}
            >
              Book Appointment
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8">
            <a
              href="tel:+63341234567"
              className="flex items-center gap-2 text-[13px] font-medium transition-colors hover:text-[#163A2B]"
              style={{ color: "#6B7A6F" }}
            >
              <Phone className="h-4 w-4 text-[#C8A96B]" />
              Call to Book
            </a>
            <span className="hidden sm:inline-block w-px h-4 bg-[#EDE4D3]" />
            <span
              className="flex items-center gap-2 text-[13px] font-medium cursor-pointer transition-colors hover:text-[#163A2B]"
              style={{ color: "#6B7A6F" }}
            >
              <MessageCircle className="h-4 w-4 text-[#C8A96B]" />
              Message Us
            </span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
