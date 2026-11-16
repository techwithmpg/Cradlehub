import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { PublicMobileAbout } from "@/components/public/mobile/public-mobile-about";
import {
  ArrowRight,
  Award,
  Calendar,
  Flower2,
  Gem,
  Heart,
  Leaf,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/components/seo/structured-data";
import { getPublicSiteSectionsCached } from "@/lib/public/public-site-cached";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";

const experiencePillars = [
  { label: "Rest & Relaxation", icon: Flower2 },
  { label: "Professional Care", icon: Leaf },
  { label: "Safe & Hygienic", icon: ShieldCheck },
  { label: "Premium Experience", icon: Gem },
] as const;

const coreValues = [
  {
    icon: Users,
    title: "Care",
    desc: "Every session is centered on attentive, personalized care.",
  },
  {
    icon: Heart,
    title: "Comfort",
    desc: "Calm spaces, quiet rooms, and warm Filipino hospitality.",
  },
  {
    icon: Award,
    title: "Quality",
    desc: "Trained therapists and thoughtfully selected spa essentials.",
  },
  {
    icon: Sparkles,
    title: "Trust",
    desc: "Consistent standards across in-spa and home service visits.",
  },
] as const;

export const metadata: Metadata = buildMetadata({
  title: "About | Cradle Wellness Living — Bacolod Massage & Spa",
  description:
    "Learn about Cradle Wellness Living in Bacolod. A calm wellness space offering massage, spa treatments, and home service with thoughtful care and premium standards.",
  path: "/about",
});

export default async function AboutPage() {
  const managedSections = await getPublicSiteSectionsCached({ includeDisabled: false });

  const resolved = resolvePublicSiteSections(managedSections);
  const storyImage =
    resolved.siteImages?.about_page_story || resolved.about.imageUrl || SPA_IMAGES.about;
  const experienceImage =
    resolved.siteImages?.about_page_experience ||
    resolved.about.secondaryImageUrl ||
    SPA_IMAGES.aboutSecondary;

  return (
    <div className="sp-public min-h-screen bg-[#071A12] text-[#FAF5E9]">
      <PublicMobileAbout headerImage={experienceImage} />
      <div className="hidden md:block">
        {/* Emerald Glass Split Hero */}
        <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] pt-24 text-[#FAF5E9]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_380px_at_15%_10%,rgba(28,89,63,0.4),transparent_65%),radial-gradient(600px_320px_at_85%_25%,rgba(212,181,122,0.12),transparent_60%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl grid-cols-12 items-center px-6 py-16 lg:py-20">
            <div className="relative z-10 col-span-6 pr-8">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#E5C98B]">
                  About Us
                </p>
                <span className="h-px w-8 bg-[#D4B57A]/60" aria-hidden="true" />
              </div>
              <h1
                className="mt-3 text-4xl font-medium leading-tight text-[#FAF5E9] lg:text-5xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Our Story
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#CBD6CD]">
                More than a spa — a sanctuary for rest, rejuvenation, and holistic wellness.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/book"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-6 text-[13px] font-semibold text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Book an Experience
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-5 text-[13px] font-semibold text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                >
                  <Leaf className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                  Our Services
                </Link>
              </div>
            </div>

            <div className="relative col-span-6 h-64 overflow-hidden rounded-2xl border border-[#D4B57A]/30 shadow-2xl lg:h-72">
              <Image
                src={storyImage}
                alt="Warm candlelight and folded spa towel at Cradle Wellness Living"
                fill
                preload
                fetchPriority="high"
                className="eg-hero-photo object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#05140E]/75 via-transparent to-transparent" />
            </div>
          </div>
        </section>

        {/* Experience Split Story */}
        <section className="bg-[#061810]/70 py-16 lg:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <ScrollReveal variant="scale" className="lg:col-span-5">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#D4B57A]/25 shadow-2xl">
                  <Image
                    src={experienceImage}
                    alt="Warm herbal bowl and glowing spa sanctuary inside Cradle Wellness Living"
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 45vw"
                  />
                </div>
              </ScrollReveal>

              <div className="lg:col-span-7">
                <ScrollReveal>
                  <h2
                    className="text-2xl font-semibold leading-tight text-[#FAF5E9] sm:text-3xl"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    The Cradle Wellness Living Experience
                  </h2>
                  <div className="mt-4 flex flex-col gap-3.5 text-[15px] leading-relaxed text-[#CBD6CD]">
                    <p>
                      Cradle Wellness Living is a calm wellness and spa sanctuary in Bacolod
                      City, dedicated to providing professional massage, beauty, and
                      holistic care that restores balance to your body, mind, and lifestyle.
                    </p>
                    <p>
                      Our approach blends warm Filipino hospitality with attentive craft.
                      Every treatment room, scent, and quiet detail is designed to help you
                      pause, breathe, and feel looked after—whether inside our branches or
                      through our home service team.
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-4 gap-4 border-t border-[#D4B57A]/20 pt-7">
                    {experiencePillars.map(({ label, icon: Icon }) => (
                      <div key={label} className="flex flex-col items-center text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <p className="mt-2.5 text-[12px] font-semibold text-[#FAF5E9]">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* Commitment & Values Band */}
        <section className="border-t border-[#D4B57A]/15 bg-[#071A12] py-16">
          <div className="mx-auto max-w-7xl px-6">
            <ScrollReveal>
              <div className="eg-glass-card grid items-center gap-10 rounded-3xl p-8 lg:grid-cols-12 lg:p-12">
                <div className="lg:col-span-5 lg:border-r lg:border-[#D4B57A]/20 lg:pr-8">
                  <h2
                    className="text-2xl font-semibold text-[#FAF5E9] sm:text-3xl"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Our Commitment
                  </h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#CBD6CD]">
                    To deliver high-quality, safe, and personalized wellness experiences
                    that help you look, feel, and live better.
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <h2
                    className="text-xl font-semibold text-[#FAF5E9]"
                    style={{ fontFamily: "var(--sp-font-display)" }}
                  >
                    Our Values
                  </h2>
                  <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
                    {coreValues.map((v) => (
                      <div key={v.title} className="flex flex-col items-center text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4B57A]/25 bg-[#0A251A]/90 text-[#E5C98B]">
                          <v.icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h3 className="mt-2.5 text-[13px] font-semibold text-[#FAF5E9]">
                          {v.title}
                        </h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#B7C6BC]">
                          {v.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
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
