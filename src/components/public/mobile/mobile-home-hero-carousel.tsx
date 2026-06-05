import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, MapPin } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

const HERO_SLIDES = [
  {
    src: SPA_IMAGES.heroMobile,
    alt: "Cradle therapist providing a warm massage treatment",
    className: "cradle-hero-slide-one",
    imageClassName: "object-center",
  },
  {
    src: SPA_IMAGES.heroWide,
    alt: "Warm Cradle massage room with treatment beds",
    className: "cradle-hero-slide-two",
    imageClassName: "object-center",
  },
  {
    src: SPA_IMAGES.heroAmbience,
    alt: "Calm Cradle spa ambience with towels and warm light",
    className: "cradle-hero-slide-three",
    imageClassName: "object-center",
  },
] as const;

const TRUST_ITEMS = [
  { icon: MapPin, label: "In-spa care" },
  { icon: Home, label: "Home service" },
  { icon: CalendarDays, label: "Two Bacolod branches" },
] as const;

export function MobileHomeHeroCarousel() {
  return (
    <section
      className="relative min-h-[100svh] w-screen overflow-hidden bg-[#0D2B20] text-[#F3E9D2]"
      aria-label="Cradle Wellness Living homepage hero"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className={`cradle-hero-slide absolute inset-0 ${slide.className}`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              className={`cradle-hero-image object-cover ${slide.imageClassName}`}
              sizes="100vw"
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,25,18,0.38)_0%,rgba(13,43,32,0.66)_42%,rgba(4,17,12,0.96)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(200,169,106,0.30)_0%,rgba(200,169,106,0.09)_30%,rgba(13,43,32,0)_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_84%,rgba(200,169,106,0.20)_0%,rgba(200,169,106,0.06)_26%,rgba(13,43,32,0)_54%)]" />

      <div className="relative flex min-h-[100svh] flex-col justify-end px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <div className="cradle-hero-copy max-w-[330px]">
          <p className="cradle-hero-fade text-[15px] italic leading-6 text-[#F3E9D2]/92 [font-family:var(--sp-font-accent)]">
            Bacolod Wellness Spa
          </p>
          <h1 className="cradle-hero-fade mt-3 text-[56px] font-semibold leading-[0.94] text-[#F3E9D2] [font-family:var(--sp-font-accent)] min-[390px]:text-[60px]">
            Rest. Renew.
            <br />
            Rejuvenate.
          </h1>
          <div className="cradle-hero-fade mt-5 h-px w-16 bg-[#C8A96A]" />
          <p className="cradle-hero-fade mt-5 max-w-[305px] text-[15px] leading-[1.65] text-[#F3E9D2]/86 [font-family:var(--sp-font-body)]">
            Experience massage, skin care, salon care, and home-service wellness
            designed for calm recovery.
          </p>

          <div className="cradle-hero-fade mt-8 flex flex-col gap-3 min-[360px]:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#C8A96A] px-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0D2B20] shadow-[0_14px_36px_rgba(200,169,106,0.34)] transition-transform active:scale-[0.98] [font-family:var(--sp-font-body)]"
            >
              Book Appointment
            </Link>
            <Link
              href="/services"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#C8A96A]/85 px-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F3E9D2] shadow-[inset_0_0_0_1px_rgba(243,233,210,0.08)] transition-colors active:bg-white/10 [font-family:var(--sp-font-body)]"
            >
              View Services
            </Link>
          </div>
        </div>

        <div className="cradle-hero-fade mt-8 rounded-full border border-[#F3E9D2]/16 bg-[#061912]/48 px-4 py-3 text-[#F3E9D2]/86 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-md [font-family:var(--sp-font-body)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold">
            {TRUST_ITEMS.map(({ icon: Icon, label }, index) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[#C8A96A]" aria-hidden="true" />
                <span>{label}</span>
                {index < TRUST_ITEMS.length - 1 ? (
                  <span className="ml-1 text-[#C8A96A]/70">·</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
