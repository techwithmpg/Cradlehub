import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Phone, Sparkles } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
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

export default function MassageSpaBacolodPage() {
  return (
    <>
      <div className="sp-public">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#10261D] pt-28 pb-16 text-[#FCFAF5] lg:pt-40 lg:pb-24">
          <div className="absolute inset-0">
            <Image
              src={SPA_IMAGES.ctaBanner}
              alt="Massage spa experience in Bacolod at Cradle Wellness Living"
              fill
              priority
              className="object-cover opacity-50"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#10261D]/70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,38,29,0.96)_0%,rgba(16,38,29,0.74)_52%,rgba(16,38,29,0.4)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,#FCFAF5_0%,rgba(252,250,245,0)_100%)]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
            <div className="max-w-3xl">
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E8D5A3]">
                Massage & Spa in Bacolod
              </p>
              <h1 className="text-4xl font-medium leading-[1.04] text-[#FCFAF5] sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--sp-font-display)" }}>
                Massage Spa Bacolod
              </h1>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/78 sm:text-base">
                Cradle Wellness Living offers a calming massage spa experience in Bacolod City.
                Visit our branches for in-spa treatments or book a convenient home service session.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#C8A96B] px-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#10261D] transition hover:bg-[#E8D5A3]"
                >
                  Book a Session
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="tel:+639177077070"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-[#F7F3EB]/28 px-7 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FCFAF5] transition hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call to Reserve
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Services Overview */}
        <section className="bg-[#FCFAF5] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
                Our Menu
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
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
                  className="rounded-[8px] border border-[#EDE4D3] bg-white p-8 transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(22,58,43,0.08)]"
                >
                  <Sparkles className="mb-5 h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
                  <h3 className="text-[16px] font-semibold text-[#163A2B]">{service.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6B7A6F]">{service.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#163A2B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
              >
                Explore Full Menu
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Branches */}
        <section className="bg-[#F7F3EB] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src={SPA_IMAGES.about}
                  alt="Cradle spa branch interior in Bacolod"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
                  Visit Us
                </p>
                <h2
                  className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
                  style={{ fontFamily: "var(--sp-font-display)" }}
                >
                  Two branches. One calm experience.
                </h2>
                <p className="mt-6 text-[15px] leading-7 text-[#6B7A6F]">
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
                    <li key={item} className="flex gap-3 text-[14px] text-[#5F6F63]">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#B68A3C]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/branches"
                    className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#163A2B] px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-[#1E4D3A]"
                  >
                    View Branch Details
                  </Link>
                  <Link
                    href="/book"
                    className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#163A2B] px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#163A2B] transition hover:bg-[#163A2B] hover:text-[#FCFAF5]"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#10261D] py-20 text-[#FCFAF5] lg:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2
              className="text-3xl font-medium leading-tight sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Experience Bacolod&apos;s calmest massage spa.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-[#F7F3EB]/68">
              Book online in under two minutes. Choose in-spa or home service, select your treatment,
              and let our team handle the rest.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#C8A96B] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#10261D] transition hover:bg-[#E8D5A3]"
              >
                Book Appointment
              </Link>
              <a
                href="tel:+639177077070"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-[#F7F3EB]/24 px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#FCFAF5] transition hover:bg-white/10"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Call 0917 707 7070
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-[#FCFAF5] py-20 lg:py-28">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center mb-12">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
                Common Questions
              </p>
              <h2
                className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
                style={{ fontFamily: "var(--sp-font-display)" }}
              >
                Massage Spa FAQ
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-[8px] border border-[#EDE4D3] bg-white p-6"
                >
                  <h3 className="text-[15px] font-semibold text-[#163A2B]">{faq.question}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#6B7A6F]">{faq.answer}</p>
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
