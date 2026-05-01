import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "./scroll-reveal";

export function BookingCtaSection() {
  return (
    <section className="relative py-28 lg:py-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src={SPA_IMAGES.booking}
          alt="Spa booking atmosphere"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,38,29,0.92) 0%, rgba(22,58,43,0.82) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <ScrollReveal>
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-5"
            style={{ color: "#C8A96B" }}
          >
            Book Online
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-6"
            style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
          >
            Book Your Massage
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: "rgba(247,243,235,0.68)" }}
          >
            Booking is simple and takes less than two minutes. Choose your preferred treatment,
            select a time that works for you, and arrive ready to unwind.
          </p>

          <Link
            href="/book"
            className="inline-flex items-center rounded-full px-10 py-4 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 mb-10"
            style={{
              background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
              color: "#10261D",
              boxShadow: "0 6px 24px rgba(200,169,107,0.45)",
            }}
          >
            Book Appointment
          </Link>

          <div>
            <p
              className="text-[11px] font-medium tracking-[0.15em] uppercase mb-3"
              style={{ color: "rgba(247,243,235,0.45)" }}
            >
              or call us at
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <a
                href="tel:+639177077070"
                className="text-2xl lg:text-3xl font-semibold transition-colors duration-300 hover:text-[#C8A96B]"
                style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
              >
                0917 707 7070
              </a>
              <span className="hidden sm:block text-[#C8A96B]/40 text-xl">|</span>
              <a
                href="tel:+639090087815"
                className="text-2xl lg:text-3xl font-semibold transition-colors duration-300 hover:text-[#C8A96B]"
                style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
              >
                0909 008 7815
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
