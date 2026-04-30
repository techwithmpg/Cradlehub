import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "./scroll-reveal";

export function CtaBannerSection() {
  return (
    <section className="relative py-28 lg:py-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src={SPA_IMAGES.ctaBanner}
          alt="Calm spa atmosphere"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,38,29,0.88) 0%, rgba(22,58,43,0.78) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <ScrollReveal>
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-5"
            style={{ color: "#C8A96B" }}
          >
            Your Wellness Journey
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-6"
            style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
          >
            Let Us Help You Release
            <br />
            Stress and Tension
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: "rgba(247,243,235,0.7)" }}
          >
            Step away from the demands of everyday life and into a space designed for your renewal.
            Our therapists are here to guide you back to balance.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center rounded-full px-10 py-4 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
              color: "#10261D",
              boxShadow: "0 6px 24px rgba(200,169,107,0.45)",
            }}
          >
            Book Your Session
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
