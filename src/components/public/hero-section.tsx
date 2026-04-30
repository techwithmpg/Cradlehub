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
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
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
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,38,29,0.82) 0%, rgba(22,58,43,0.65) 50%, rgba(16,38,29,0.75) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-32 w-full">
        <div className="max-w-2xl">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-6"
            style={{ color: "#C8A96B" }}
          >
            Wellness & Relaxation
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.1] mb-6"
            style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
          >
            Relax, Restore,
            <br />
            <span style={{ color: "#C8A96B" }}>Rejuvenate</span>
          </h1>
          <p
            className="text-[15px] sm:text-[16px] leading-relaxed mb-10 max-w-lg"
            style={{ color: "rgba(247,243,235,0.75)" }}
          >
            Experience luxury massage and wellness treatments in a calm, restorative space.
            Let our skilled therapists guide you back to balance.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-10">
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

          <div className="flex flex-wrap items-center gap-5">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C8A96B]/20">
                  <Check className="h-3 w-3 text-[#C8A96B]" />
                </div>
                <span className="text-[12px] font-medium" style={{ color: "rgba(247,243,235,0.65)" }}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{
          background: "linear-gradient(to top, #F7F3EB, transparent)",
        }}
      />
    </section>
  );
}
