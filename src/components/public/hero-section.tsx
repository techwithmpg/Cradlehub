import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { Check } from "lucide-react";

const trustPoints = [
  "Professional Therapists",
  "Relaxing Ambience",
  "Personalized Care",
];

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex flex-col overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={SPA_IMAGES.hero}
          alt="Luxury spa treatment room"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />

        {/* Layer 1: subtle overall dark tint — preserves image visibility */}
        <div className="absolute inset-0 bg-[#10261D]/30" />

        {/* Layer 2: soft left-side gradient for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(16,38,29,0.82) 0%, rgba(16,38,29,0.45) 45%, transparent 75%)",
          }}
        />

        {/* Layer 3: gentle bottom fade into page background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(16,38,29,0.55) 0%, transparent 35%)",
          }}
        />

        {/* Layer 4: optional top vignette for nav blend */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(16,38,29,0.35) 0%, transparent 20%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {/* Spacer for fixed header */}
        <div className="h-20" />

        {/* Main hero content — centered vertically, aligned within container */}
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-12 py-16 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              {/* Eyebrow */}
              <p
                className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-5"
                style={{ color: "#C8A96B" }}
              >
                Wellness & Relaxation
              </p>

              {/* Headline */}
              <h1
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-medium leading-[1.12] mb-6"
                style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
              >
                Relax, Restore,
                <br />
                <span style={{ color: "#C8A96B" }}>Rejuvenate</span>
              </h1>

              {/* Subhead */}
              <p
                className="text-[15px] sm:text-[16px] leading-relaxed mb-10 max-w-lg mx-auto"
                style={{ color: "rgba(247,243,235,0.78)" }}
              >
                Experience luxury massage and wellness treatments in a calm, restorative space.
                Let our skilled therapists guide you back to balance.
              </p>

              {/* CTA row */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                <Link
                  href="/book"
                  className="inline-flex items-center rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                    color: "#10261D",
                    boxShadow: "0 6px 24px rgba(200,169,107,0.45)",
                  }}
                >
                  Book Appointment
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center rounded-full px-8 py-3.5 text-[12px] font-medium tracking-widest uppercase border transition-all duration-300 hover:bg-white/10"
                  style={{
                    borderColor: "rgba(247,243,235,0.25)",
                    color: "rgba(247,243,235,0.9)",
                  }}
                >
                  Explore Services
                </Link>
              </div>

              {/* Trust points */}
              <div className="flex flex-wrap items-center justify-center gap-5">
                {trustPoints.map((point) => (
                  <div key={point} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C8A96B]/20">
                      <Check className="h-3 w-3 text-[#C8A96B]" />
                    </div>
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "rgba(247,243,235,0.65)" }}
                    >
                      {point}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
