import Image from "next/image";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { Heart, Award, Sparkles, Leaf } from "lucide-react";

const values = [
  {
    icon: Leaf,
    title: "Natural Healing",
    desc: "We use premium natural oils and time-honored techniques that work in harmony with your body.",
  },
  {
    icon: Award,
    title: "Certified Expertise",
    desc: "Our therapists undergo rigorous training and hold certifications in therapeutic and relaxation massage.",
  },
  {
    icon: Heart,
    title: "Whole-Person Care",
    desc: "We treat more than muscles — we create space for mental calm, emotional release, and physical renewal.",
  },
  {
    icon: Sparkles,
    title: "Impeccable Standards",
    desc: "From sanitation to ambiance, every detail is curated to ensure a safe, luxurious, and restorative experience.",
  },
];

export default function AboutPage() {
  return (
    <div className="sp-public">
      {/* Page Header */}
      <div className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: "#F7F3EB" }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            About Us
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            A Sanctuary for
            <br />
            Mind, Body & Soul
          </h1>
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
                    created a sanctuary where the outside world fades and your wellness takes center stage.
                  </p>
                  <p>
                    Our founders, passionate about holistic healing and Filipino hospitality, envisioned
                    a spa that blends traditional therapeutic techniques with modern luxury. Every
                    treatment room, every scent, every touch is designed to guide you back to your
                    most balanced self.
                  </p>
                  <p>
                    Whether you seek relief from chronic tension, a moment of quiet escape, or a shared
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
                    From the moment you arrive, you are wrapped in calm. Soft lighting, gentle aromatherapy,
                    and warm herbal tea set the tone before your treatment even begins.
                  </p>
                  <p>
                    Our therapists take time to understand your needs — whether it is targeting a specific
                    area of tension or simply creating space for deep relaxation. No two sessions are alike
                    because no two bodies are alike.
                  </p>
                  <p>
                    After your treatment, linger in our relaxation lounge. Let the benefits settle. Leave
                    when you are ready, carrying the calm with you into the rest of your day.
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
  );
}
