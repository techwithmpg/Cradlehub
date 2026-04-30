import Image from "next/image";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "./scroll-reveal";
import { Heart, Award, Sparkles } from "lucide-react";

const highlights = [
  {
    icon: Award,
    title: "Experienced Therapists",
    desc: "Certified professionals with years of hands-on expertise in therapeutic and relaxation massage.",
  },
  {
    icon: Sparkles,
    title: "Relaxing Treatments",
    desc: "Curated therapies using premium oils, natural ingredients, and time-honored techniques.",
  },
  {
    icon: Heart,
    title: "Personalized Sessions",
    desc: "Every treatment is tailored to your body, your stress points, and your wellness goals.",
  },
];

export function AboutSection() {
  return (
    <section className="py-24 lg:py-32" style={{ background: "#F7F3EB" }}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <ScrollReveal variant="scale">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
              <Image
                src={SPA_IMAGES.about}
                alt="Cradle Spa interior"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to top, rgba(16,38,29,0.3), transparent 60%)",
                }}
              />
            </div>
          </ScrollReveal>

          {/* Content */}
          <div>
            <ScrollReveal>
              <p
                className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ color: "#C8A96B" }}
              >
                About Us
              </p>
              <h2
                className="text-3xl sm:text-4xl font-medium leading-tight mb-6"
                style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
              >
                Welcome to Cradle Massage & Wellness Spa
              </h2>
              <p className="text-[15px] leading-relaxed mb-6" style={{ color: "#6B7A6F" }}>
                At Cradle, we believe that true wellness begins with stillness. Nestled in the heart of
                Bacolod City, our spa is a sanctuary designed to help you disconnect from the noise of
                daily life and reconnect with your body.
              </p>
              <p className="text-[15px] leading-relaxed mb-10" style={{ color: "#6B7A6F" }}>
                From the moment you step inside, you are greeted by calming scents, soft ambient light,
                and a team of dedicated therapists who listen to your needs. Every session is crafted
                to restore balance, ease tension, and leave you feeling renewed.
              </p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-3 gap-6">
              {highlights.map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 120}>
                  <div className="group">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#163A2B]/5 text-[#163A2B] mb-4 transition-colors duration-300 group-hover:bg-[#163A2B] group-hover:text-[#C8A96B]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3
                      className="text-[14px] font-semibold mb-2"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "#6B7A6F" }}>
                      {item.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
