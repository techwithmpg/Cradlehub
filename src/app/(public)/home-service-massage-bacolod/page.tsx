import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Home, Phone } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getPublicSiteSectionsCached } from "@/lib/public/public-site-cached";
import { resolvePublicSiteSections } from "@/lib/public/normalized-sections";
import { buildMetadata } from "@/lib/seo/metadata";
import { ServiceJsonLd, BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Home Service Massage Bacolod | Book a Therapist to Your Door",
  description:
    "Book home service massage in Bacolod with Cradle Wellness Living. Professional therapists come to your home for relaxation, tension relief, and wellness. Schedule online or call 0917 707 7070.",
  path: "/home-service-massage-bacolod",
});

const faqs = [
  {
    question: "How do I book a home service massage in Bacolod?",
    answer:
      "Visit cradlewellnessliving.com/book and select Home Service. Enter your address, choose your treatment, pick a time, and confirm. Our front desk may call to verify details.",
  },
  {
    question: "What areas in Bacolod do you cover?",
    answer:
      "We serve homes and accommodations across Bacolod City. When booking, provide your complete address and a nearby landmark so our therapist can arrive smoothly.",
  },
  {
    question: "Is home service massage safe and professional?",
    answer:
      "Yes. Our therapists follow the same professional standards for home visits as they do in-spa. Clean linens, prepared oils, and respectful service are part of every appointment.",
  },
  {
    question: "What massages are available for home service?",
    answer:
      "Popular options include Swedish, deep tissue, and foot reflexology. Availability depends on therapist schedules and the service you select during booking.",
  },
];

export default async function HomeServiceMassagePage() {
  const managedSections = await getPublicSiteSectionsCached({ includeDisabled: false });

  const resolved = resolvePublicSiteSections(managedSections);
  const heroBanner = resolved.siteImages?.landing_home_banner || SPA_IMAGES.booking;
  const setupImage = resolved.siteImages?.landing_home_setup || SPA_IMAGES.booking;

  return (
    <>
      <div className="sp-public min-h-screen bg-[#071A12] text-[#FAF5E9]">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] pt-28 pb-16 text-[#FAF5E9] lg:pt-40 lg:pb-24">
          <div className="absolute inset-0">
            <Image
              src={heroBanner}
              alt="Home service massage setup in Bacolod"
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
                Home Service Wellness
              </p>
              <h1 className="text-4xl font-medium leading-[1.04] text-[#FAF5E9] sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--sp-font-display)" }}>
                Home Service Massage in Bacolod
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#CBD6CD] sm:text-base">
                Cradle Wellness Living brings professional massage and wellness therapy to your doorstep
                in Bacolod. Book a calm, private session at home without the travel.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
                >
                  Book Home Service
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="tel:+639177077070"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                >
                  <Phone className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                  Call to Book
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Why Home Service */}
        <section className="bg-[#071A12] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                  Wellness at Home
                </p>
                <h2
                  className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Relax without leaving your space.
                </h2>
                <p className="mt-6 text-[15px] leading-7 text-[#CBD6CD]">
                  Some days, the best spa is the one that comes to you. Our home service massage in Bacolod
                  is designed for guests who prefer comfort, privacy, and zero travel time.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Same trained therapists as in-spa visits",
                    "Clean linens and prepared oils brought to you",
                    "Flexible scheduling based on availability",
                    "Ideal for recovery, stress relief, or quiet self-care",
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[14px] text-[#CBD6CD]">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#E5C98B]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#D4B57A]/25 shadow-2xl">
                <Image
                  src={setupImage}
                  alt="Prepared home service massage setup in Bacolod"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-[#D4B57A]/15 bg-[#061810]/70 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E5C98B]">
                Simple Booking
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                How Home Service Works
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Book Online",
                  desc: "Choose Home Service at cradlewellnessliving.com/book and enter your Bacolod address.",
                },
                {
                  step: "02",
                  title: "Confirm Details",
                  desc: "Select your massage type, date, and time. Our team may call to confirm your location.",
                },
                {
                  step: "03",
                  title: "Relax at Home",
                  desc: "Your therapist arrives with everything needed for a calm, professional session.",
                },
              ].map((card) => (
                <div
                  key={card.step}
                  className="eg-glass-card eg-glass-lift rounded-2xl p-8"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E5C98B]">
                    {card.step}
                  </p>
                  <h3 className="mt-3 text-xl font-medium text-[#FAF5E9]" style={{ fontFamily: "var(--sp-font-display)" }}>
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-6 text-[#CBD6CD]">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[#D4B57A]/15 bg-[#05140E] py-20 text-[#FAF5E9] lg:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <Home className="mx-auto mb-6 h-8 w-8 text-[#E5C98B]" aria-hidden="true" />
            <h2
              className="text-3xl font-medium leading-tight text-[#FAF5E9] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Ready for a home massage in Bacolod?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#CBD6CD]">
              Book in under two minutes. Choose your treatment, share your address, and let us bring
              the Cradle experience to your door.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-8 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#071A12] shadow-[0_8px_24px_-8px_rgba(212,181,122,0.55)] transition hover:brightness-105"
              >
                Book Home Service
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
                Home Service Massage FAQ
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
        serviceName="Home Service Massage Bacolod"
        description="Professional home service massage in Bacolod City by Cradle Wellness Living. Therapists come to your door with linens, oils, and calm expertise."
        urlPath="/home-service-massage-bacolod"
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Home Service Massage Bacolod", path: "/home-service-massage-bacolod" },
        ]}
      />
      <FAQPageJsonLd faqs={faqs} />
    </>
  );
}
