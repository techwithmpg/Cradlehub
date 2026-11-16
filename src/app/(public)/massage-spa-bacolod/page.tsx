import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Phone, Sparkles } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getPublicSiteSectionsCached } from "@/lib/public/public-site-cached";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { buildMetadata } from "@/lib/seo/metadata";
import { ServiceJsonLd, BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Massage Spa Bacolod | In-Spa & Home Service — Cradle Wellness Living",
  description:
    "Discover premium massage and spa services in Bacolod at Cradle Wellness Living. In-spa treatments at SM City and La Luz branches, plus home service. Book online today.",
  path: "/massage-spa-bacolod",
});

const faqs = [
  {
    question: "What makes Cradle Wellness Living a top massage spa in Bacolod?",
    answer:
      "Cradle combines trained therapists, calm treatment rooms, and flexible booking for in-spa and home service. With two Bacolod branches and a guided online reservation system, we make wellness easy to access.",
  },
  {
    question: "Where are your spa branches in Bacolod?",
    answer:
      "We are located at SM City Bacolod (3rd Floor, North Wing) and La Luz Branch (3rd Floor, La Luz Building, Lacson National Highway). Both branches offer massage, salon, skin care, and spa packages.",
  },
  {
    question: "Can I book a spa package for a group?",
    answer:
      "Yes. We offer spa party packages for groups. Contact our front desk or browse packages online to plan a shared wellness experience.",
  },
  {
    question: "Do you offer couples massage?",
    answer:
      "Yes. Couples and shared treatments are available. Book online and select the service that fits your group, or call us to arrange a custom session.",
  },
];

export default async function MassageSpaBacolodPage() {
  const managedSections = await getPublicSiteSectionsCached({ includeDisabled: false });

  const resolved = resolvePublicSiteSections(managedSections);
  const heroBanner = resolved.siteImages?.landing_spa_banner || SPA_IMAGES.ctaBanner;
  const storyImage = resolved.siteImages?.landing_spa_story || SPA_IMAGES.about;

  return (
    <>
      <div className="sp-public min-h-screen bg-[#071A12] text-[#FAF5E9]">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] pt-28 pb-16 text-[#FAF5E9] lg:pt-40 lg:pb-24">
          <div className="absolute inset-0">
            <Image
              src={heroBanner}
              alt="Massage spa experience in Bacolod at Cradle Wellness Living"
              fill
              preload
              fetchPriority="high"
              className="eg-hero-photo object-cover opacity-50"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#05140E]/70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,20,14,0.96)_0%,rgba(5,20,14,0.78)_52%,rgba(5,20,14,0.4)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,#071A12_0%,rgba(7,26,18,0)_100%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
            <div className="max-w-3xl">
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E5C98B]">
                Massage & Spa in Bacolod
              </p>
              <h1 className="text-4xl font-medium leading-[1.04] text-[#FAF5E9] sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--sp-font-display)" }}>
                Massage Spa Bacolod
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#CBD6CD] sm:text-base">
                Cradle Wellness Living offers a calming massage spa experience in Bacolod City.
                Visit our branches for in-spa treatments or book a convenient home service session.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
                >
                  Book a Session
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="tel:+639177077070"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                >
                  <Phone className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                  Call to Reserve
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Services Overview */}
        <section className="bg-[#071A12] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                Our Menu
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Treatments designed for rest and recovery.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Massage Services",
                  desc: "Swedish, deep tissue, hot stone, and foot reflexology for tension relief and relaxation.",
                },
                {
                  title: "Salon Services",
                  desc: "Hair and nail care to complete your self-care routine alongside your spa visit.",
                },
                {
                  title: "Skin Care",
                  desc: "Facials and skin treatments tailored to refresh and renew your complexion.",
                },
                {
                  title: "Divine Renewal Packages",
                  desc: "Curated combinations of massage, skin care, and body treatments for full renewal.",
                },
                {
                  title: "Spa Party Packages",
                  desc: "Group bookings for celebrations, team events, or shared relaxation with friends.",
                },
                {
                  title: "Home Service Massage",
                  desc: "The same spa-quality massage brought to your home anywhere in Bacolod City.",
                },
              ].map((service) => (
                <div
                  key={service.title}
                  className="eg-glass-card eg-glass-lift rounded-2xl p-8"
                >
                  <Sparkles className="mb-5 h-5 w-5 text-[#E5C98B]" aria-hidden="true" />
                  <h3 className="text-[16px] font-semibold text-[#FAF5E9]">{service.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#CBD6CD]">{service.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
              >
                Explore Full Menu
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Branches */}
        <section className="border-t border-[#D4B57A]/15 bg-[#061810]/70 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#D4B57A]/25 shadow-2xl">
                <Image
                  src={storyImage}
                  alt="Cradle spa branch interior in Bacolod"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                  Visit Us
                </p>
                <h2
                  className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Two branches. One calm experience.
                </h2>
                <p className="mt-6 text-[15px] leading-7 text-[#CBD6CD]">
                  Whether you are near SM City or along Lacson Street, a Cradle branch is within reach.
                  Both locations offer the same thoughtful service, clean spaces, and skilled therapists.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "SM City Bacolod — 3rd Floor, North Wing",
                    "La Luz Branch — 3rd Floor, La Luz Building, Lacson National Highway",
                    "Daily availability through online booking",
                    "In-spa and home service options",
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[14px] text-[#CBD6CD]">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#E5C98B]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/branches"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                  >
                    View Branch Details
                  </Link>
                  <Link
                    href="/book"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[#D4B57A]/15 bg-[#05140E] py-20 text-[#FAF5E9] lg:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2
              className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Experience Bacolod&apos;s calmest massage spa.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#CBD6CD]">
              Book online in under two minutes. Choose in-spa or home service, select your treatment,
              and let our team handle the rest.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
              >
                Book Appointment
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-8 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
              >
                <Phone className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                Call 0917 707 7070
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-[#D4B57A]/15 bg-[#071A12] py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-6">
            <div className="mb-12 text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                Common Questions
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Massage Spa FAQ
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="eg-glass-card rounded-2xl p-6"
                >
                  <h3 className="text-[15px] font-semibold text-[#FAF5E9]">{faq.question}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#CBD6CD]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <ServiceJsonLd
        serviceName="Massage Spa Bacolod"
        description="Premium massage and spa services in Bacolod City at Cradle Wellness Living. In-spa treatments and home service massage with trained therapists."
        urlPath="/massage-spa-bacolod"
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Massage Spa Bacolod", path: "/massage-spa-bacolod" },
        ]}
      />
      <FAQPageJsonLd faqs={faqs} />
    </>
  );
}
