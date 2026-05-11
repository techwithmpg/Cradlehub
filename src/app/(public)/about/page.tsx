import type { Metadata } from "next";
import Image from "next/image";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileAbout } from "@/components/public/mobile/public-mobile-about";
import { Heart, Award, Sparkles, Leaf } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";

const values = [
  {
    icon: Leaf,
    title: "Wellness-Led Care",
    desc: "We focus on calm, comfort, and thoughtful techniques that support everyday rest and renewal.",
  },
  {
    icon: Award,
    title: "Thoughtful Technique",
    desc: "Our team brings attentive service to each session, with pressure and pacing guided by your comfort.",
  },
  {
    icon: Heart,
    title: "Whole-Person Care",
    desc: "We create space for the body to rest, the mind to settle, and your day to slow down.",
  },
  {
    icon: Sparkles,
    title: "Carefully Kept Standards",
    desc: "From clean spaces to warm details, every visit is prepared to feel comfortable and cared for.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: "About | Cradle Wellness Living — Bacolod Massage & Spa",
  description:
    "Learn about Cradle Wellness Living in Bacolod. A calm wellness space offering massage, spa treatments, and home service with thoughtful care and premium standards.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="sp-public">
      <PublicMobileAbout />
      <div className="hidden md:block">
        {/* Dark hero — matches mobile header */}
        <div
          className="pt-28 pb-14 lg:pt-36 lg:pb-20"
          style={{ background: "#10261D" }}
        >
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p
              className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "#C8A96B" }}
            >
              About Cradle
            </p>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-4"
              style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
            >
              Your Wellness Is
              <br />
              Our Passion
            </h1>
            <p className="text-[15px] max-w-xl mx-auto" style={{ color: "rgba(252,250,245,0.65)" }}>
              A calm, caring space for everyone who needs to pause, breathe, and feel looked after.
            </p>
          </div>
        </div>

        {/* Story Section */}
        <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <ScrollReveal variant="scale">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src={SPA_IMAGES.about}
                    alt="Cradle Spa interior"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </ScrollReveal>

              <div>
                <ScrollReveal>
                  <h2
                    className="text-2xl sm:text-3xl font-medium leading-tight mb-6"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                  >
                    Our Story
                  </h2>
                  <div className="flex flex-col gap-4 text-[15px] leading-relaxed" style={{ color: "#6B7A6F" }}>
                    <p>
                      Cradle Massage & Wellness Spa was born from a simple belief: that everyone deserves
                      a place to pause, breathe, and be cared for. In the heart of Bacolod City, we have
                      created a calming space where the outside world can soften and your wellness takes center stage.
                    </p>
                    <p>
                      Our approach blends familiar Filipino hospitality with a warm spa experience. Every
                      treatment room, every scent, and every thoughtful detail is designed to help you
                      feel present, rested, and cared for.
                    </p>
                    <p>
                      Whether you seek relief from everyday tension, a moment of quiet escape, or a shared
                      experience with someone you love, Cradle is here to hold space for your renewal.
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 lg:py-28" style={{ background: "#F7F3EB" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <ScrollReveal>
                <p
                  className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                  style={{ color: "#C8A96B" }}
                >
                  Our Philosophy
                </p>
                <h2
                  className="text-2xl sm:text-3xl font-medium"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  What We Stand For
                </h2>
              </ScrollReveal>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((v, i) => (
                <ScrollReveal key={v.title} delay={i * 100}>
                  <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mb-5">
                      <v.icon className="h-6 w-6" />
                    </div>
                    <h3
                      className="text-[16px] font-semibold mb-3"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                    >
                      {v.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "#6B7A6F" }}>
                      {v.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Secondary Image */}
        <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1">
                <ScrollReveal>
                  <h2
                    className="text-2xl sm:text-3xl font-medium leading-tight mb-6"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                  >
                    The Cradle Experience
                  </h2>
                  <div className="flex flex-col gap-4 text-[15px] leading-relaxed" style={{ color: "#6B7A6F" }}>
                    <p>
                      From the moment you arrive, you are welcomed into calm. Soft lighting, quiet details,
                      and a slower pace set the tone before your treatment even begins.
                    </p>
                    <p>
                      Our therapists take time to understand your needs, whether it is targeting a specific
                      area of tension or simply creating space for deep relaxation. No two sessions are alike
                      because no two bodies are alike.
                    </p>
                    <p>
                      After your treatment, take a quiet moment before returning to your day. Let the calm
                      settle in and carry it with you beyond the spa.
                    </p>
                  </div>
                </ScrollReveal>
              </div>
              <ScrollReveal variant="scale" className="order-1 lg:order-2">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src={SPA_IMAGES.aboutSecondary}
                    alt="Spa relaxation lounge"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </div>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ]}
      />
    </div>
  );
}
