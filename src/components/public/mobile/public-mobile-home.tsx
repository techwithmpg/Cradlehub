import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Home,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getPublicServiceCatalog } from "@/lib/queries/services";
import type { PublicCatalogService } from "@/lib/queries/services";

// ── Static data ─────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  { Icon: Users,      label: "Professional Therapists", sub: "Highly trained & caring" },
  { Icon: Sparkles,   label: "Premium Care",            sub: "Thoughtful service & products" },
  { Icon: ShieldCheck,label: "Clean & Safe",            sub: "Your comfort is our priority" },
  { Icon: Star,       label: "Trusted Clients",         sub: "Loved by guests who return" },
] as const;

const TESTIMONIALS = [
  { text: "The service felt calm, careful, and professional from start to finish.", name: "A. Guest" },
  { text: "The space is clean, peaceful, and easy to relax in.",                   name: "Cradle Client" },
  { text: "A refreshing experience that makes self-care feel simple.",             name: "Regular Guest" },
] as const;

const CATEGORY_IMAGE: Record<string, string> = {
  "Massage Services":          SPA_IMAGES.swedish,
  "Salon Services":            SPA_IMAGES.contact,
  "Skin Care Services":        SPA_IMAGES.aromatherapy,
  "Divine Renewal Packages":   SPA_IMAGES.couples,
  "Spa Party Packages":        SPA_IMAGES.hotStone,
};

function serviceImg(categoryName: string): string {
  return CATEGORY_IMAGE[categoryName] ?? SPA_IMAGES.ctaBanner;
}

// ── Component ────────────────────────────────────────────────────────────────

export async function PublicMobileHome() {
  // Fetch top public services — fail gracefully so the page still renders
  let featured: PublicCatalogService[] = [];
  try {
    const all = await getPublicServiceCatalog();
    featured = all
      .filter((s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip)
      .slice(0, 4);
  } catch {
    // non-fatal — section simply hidden when data unavailable
  }

  return (
    <div className="md:hidden bg-[#F7F1E7] pb-24 pt-14 text-[#10261D]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[420px] overflow-hidden">
        <Image
          src={SPA_IMAGES.hero}
          alt="Relaxing Cradle massage treatment"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* gradient: transparent top → deep green bottom */}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,46,34,0.93)_0%,rgba(16,38,29,0.32)_52%,rgba(16,38,29,0.06)_100%)]" />

        <div className="absolute inset-x-0 bottom-0 px-5 pb-9 text-[#FCFAF5]">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
            Your Wellness Is Our Passion
          </p>
          <h1
            className="text-[36px] font-medium leading-[1.04]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Rest. Renew.{" "}
            <span style={{ color: "#C8A96B" }}>Rejuvenate.</span>
          </h1>
          <p className="mt-3 max-w-[270px] text-[14px] leading-6 text-[#FCFAF5]/84">
            Experience the healing touch of Cradle.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/book"
              className="flex min-h-12 items-center justify-center rounded-[8px] text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{
                background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                color: "#10261D",
              }}
            >
              Book Now
            </Link>
            <Link
              href="/services"
              className="flex min-h-12 items-center justify-center rounded-[8px] border border-[#FCFAF5]/30 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#FCFAF5]"
            >
              Our Services
            </Link>
          </div>
        </div>
      </section>

      {/* ── Choose Your Experience ────────────────────────────────────────── */}
      <section className="-mt-5 rounded-t-[24px] bg-[#FBF6EC] px-4 pb-6 pt-6 shadow-[0_-10px_28px_rgba(16,38,29,0.10)]">
        <div className="mb-5 text-center">
          <h2 className="text-[18px] font-semibold">Choose Your Experience</h2>
          <p className="mt-1.5 text-[12px] text-[#5F6F63]">
            How would you like to be cared for today?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* In-Spa */}
          <Link
            href="/book"
            className="flex flex-col items-center rounded-[12px] border border-[#E9DDC8] bg-white p-4 text-center shadow-[0_4px_16px_rgba(16,38,29,0.06)] transition hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F6E8C8]">
              <Sparkles className="h-7 w-7 text-[#9A6A1F]" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">In-Spa</h3>
            <p className="mt-1.5 text-[11px] leading-5 text-[#5F6F63]">
              Visit our serene spa and indulge in pure relaxation.
            </p>
            <ArrowRight className="mt-3 h-4 w-4 text-[#C8A96B]" aria-hidden="true" />
          </Link>

          {/* Home Service */}
          <Link
            href="/book"
            className="flex flex-col items-center rounded-[12px] border border-[#E9DDC8] bg-[#F5EFE4] p-4 text-center shadow-[0_4px_16px_rgba(16,38,29,0.04)] transition hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F6E8C8]">
              <Home className="h-7 w-7 text-[#9A6A1F]" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-[14px] font-semibold">Home Service</h3>
            <p className="mt-1.5 text-[11px] leading-5 text-[#5F6F63]">
              We bring the spa experience to your doorstep.
            </p>
            <ArrowRight className="mt-3 h-4 w-4 text-[#C8A96B]" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-3 text-center text-[10px] text-[#9AA89A]">
          Available from participating branches.
        </p>
      </section>

      {/* ── Why Choose Cradle ────────────────────────────────────────────── */}
      <section className="bg-[#FBF6EC] px-4 pb-6">
        <div className="rounded-[14px] bg-white p-5 shadow-[0_4px_18px_rgba(16,38,29,0.07)]">
          <h2 className="mb-4 text-center text-[16px] font-semibold">Why Choose Cradle</h2>
          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-[#F0E8D8]">
            {TRUST_ITEMS.map(({ Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center p-3 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#082E22]">
                  <Icon className="h-4 w-4 text-[#C8A96B]" aria-hidden="true" />
                </div>
                <p className="mt-2 text-[12px] font-semibold leading-[1.3]">{label}</p>
                <p className="mt-1 text-[10px] leading-4 text-[#6B7A6F]">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular Services ─────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-[#FBF6EC] px-4 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Popular Services</h2>
            <Link
              href="/services"
              className="flex items-center gap-1 text-[11px] font-semibold text-[#B68A3C]"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {featured.map((service, index) => (
              <article
                key={service.id}
                className="w-[148px] shrink-0 overflow-hidden rounded-[12px] border border-[#E8DDCA] bg-white shadow-[0_4px_14px_rgba(16,38,29,0.06)]"
              >
                <div className="relative h-[90px]">
                  <Image
                    src={serviceImg(service.categoryName)}
                    alt={service.name}
                    fill
                    className="object-cover"
                    sizes="148px"
                  />
                  {index === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-[#C8A96B] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#10261D]">
                      Best Seller
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-1 text-[12px] font-semibold">{service.name}</h3>
                  <p className="mt-0.5 text-[10px] text-[#6B7A6F]">{service.durationText}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#9A6A1F]">{service.priceLabel}</p>
                    <Link
                      href="/book"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#082E22] text-[#C8A96B]"
                      aria-label={`Book ${service.name}`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Special Packages ─────────────────────────────────────────────── */}
      <section className="px-4 pb-6">
        <div className="relative min-h-[180px] overflow-hidden rounded-[16px] shadow-[0_8px_24px_rgba(16,38,29,0.14)]">
          <Image
            src={SPA_IMAGES.ctaBanner}
            alt="Cradle special wellness packages"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#082E22]/82" />
          <div className="relative px-5 py-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
              Best Value
            </p>
            <h2
              className="mt-2 text-[22px] font-medium text-[#FCFAF5]"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Special Packages
            </h2>
            <p className="mt-2 max-w-[220px] text-[12px] leading-5 text-[#FCFAF5]/78">
              Choose from our curated packages designed for your wellness journey.
            </p>
            <Link
              href="/services"
              className="mt-5 inline-flex min-h-10 items-center rounded-full px-5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                color: "#10261D",
              }}
            >
              Explore Packages
            </Link>
          </div>
        </div>
      </section>

      {/* ── Guest Impressions ────────────────────────────────────────────── */}
      <section className="bg-[#FBF6EC] px-4 pb-6">
        <h2 className="mb-4 text-[16px] font-semibold">Guest Impressions</h2>
        <div className="flex flex-col gap-3">
          {TESTIMONIALS.map(({ text, name }) => (
            <div
              key={name}
              className="rounded-[12px] border border-[#E8DDCA] bg-white p-4 shadow-[0_2px_10px_rgba(16,38,29,0.04)]"
            >
              <div className="mb-2 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Star key={i} className="h-3 w-3 fill-[#C8A96B] text-[#C8A96B]" aria-hidden="true" />
                ))}
              </div>
              <p className="text-[12px] italic leading-5 text-[#3F4F44]">&ldquo;{text}&rdquo;</p>
              <p className="mt-2 text-[10px] font-semibold text-[#9AA89A]">— {name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Inside Cradle Experience ─────────────────────────────────────── */}
      <section className="px-4 pb-2">
        <div className="overflow-hidden rounded-[14px] border border-[#E8DDCA] bg-[#FCFAF5] shadow-[0_8px_22px_rgba(16,38,29,0.08)]">
          <div className="relative h-[142px]">
            <Image
              src={SPA_IMAGES.about}
              alt="Inside the Cradle spa experience"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,38,29,0.58),rgba(16,38,29,0.08))]" />
          </div>
          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B68A3C]">
              Inside Cradle
            </p>
            <h2 className="mt-1 text-[17px] font-semibold">
              Inside the Cradle Experience
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[#5F6F63]">
              Step into a calming space designed for rest, recovery, and everyday renewal.
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[#5F6F63]">
              From soothing treatments to thoughtful details, every part of Cradle is created to help you feel cared for.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
