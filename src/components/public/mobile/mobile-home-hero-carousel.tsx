import Image from "next/image";
import Link from "next/link";
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
              preload={index === 0}
              className={`cradle-hero-image object-cover ${slide.imageClassName}`}
              sizes="100vw"
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(212,181,122,0.18)_0%,rgba(212,181,122,0.05)_34%,transparent_58%),linear-gradient(90deg,rgba(3,27,22,0.78)_0%,rgba(3,27,22,0.42)_46%,rgba(3,27,22,0.12)_100%),linear-gradient(180deg,rgba(3,27,22,0.12)_0%,rgba(3,27,22,0.78)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_72%,rgba(3,27,22,0.62)_0%,rgba(3,27,22,0.22)_38%,transparent_70%)]" />

      <div className="relative flex min-h-[100svh] flex-col justify-end px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <div className="cradle-hero-copy max-w-[330px] [text-shadow:0_2px_22px_rgba(4,17,12,0.72)]">
          <p className="cradle-hero-fade text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D4B57A] [font-family:var(--sp-font-body)]">
            Cradle Wellness Living
          </p>
          <h1 className="cradle-hero-fade mt-4 text-[58px] font-semibold leading-[0.92] text-[#F6EBD6] [font-family:var(--sp-font-accent)] min-[390px]:text-[62px]">
            Where calm
            <br />
            meets care.
          </h1>
          <div className="cradle-hero-fade mt-5 h-px w-16 bg-[#C8A96A]" />
          <p className="cradle-hero-fade mt-5 max-w-[315px] text-[15px] leading-[1.65] text-[#F6EBD6]/86 [font-family:var(--sp-font-body)]">
            A warm wellness experience for tired bodies, quiet minds, and
            moments that deserve gentle attention.
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
      </div>
    </section>
  );
}
