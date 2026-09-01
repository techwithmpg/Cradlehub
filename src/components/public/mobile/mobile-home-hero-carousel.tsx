import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import type { NormalizedHeroSection } from "@/lib/public/normalized-sections";

type MobileHomeHeroCarouselProps = {
  hero?: NormalizedHeroSection;
};

export function MobileHomeHeroCarousel({ hero }: MobileHomeHeroCarouselProps) {
  if (hero && !hero.isEnabled) {
    return null;
  }

  const brandEyebrow = hero?.brandEyebrow ?? "Cradle Wellness Living";
  const title = hero?.title ?? "Where calm\nmeets care.";
  const subtitle =
    hero?.subtitle ??
    "A warm wellness experience for tired bodies, quiet minds, and moments that deserve gentle attention.";
  const ctaLabel = hero?.ctaLabel ?? "Book Appointment";
  const ctaHref = hero?.ctaHref ?? "/book";
  const secondaryCtaLabel = hero?.secondaryCtaLabel ?? "View Services";
  const secondaryCtaHref = hero?.secondaryCtaHref ?? "/services";

  const heroSlides = [
    {
      src: hero?.imageUrl || SPA_IMAGES.heroMobile,
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

  return (
    <section
      className="relative min-h-[100svh] w-screen overflow-hidden bg-[#0D2B20] text-[#F3E9D2]"
      aria-label="Cradle Wellness Living homepage hero"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.src + index}
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

      <div className="absolute inset-0 bg-[#B88945]/12 mix-blend-soft-light" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_34%,rgba(212,181,122,0.22)_0%,rgba(212,181,122,0.08)_32%,transparent_58%),radial-gradient(circle_at_18%_78%,rgba(184,137,69,0.16)_0%,transparent_36%),linear-gradient(90deg,rgba(3,27,22,0.76)_0%,rgba(3,27,22,0.44)_44%,rgba(3,27,22,0.16)_78%,rgba(3,27,22,0.06)_100%),linear-gradient(180deg,rgba(3,27,22,0.08)_0%,rgba(3,27,22,0.24)_45%,rgba(3,27,22,0.74)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_72%,rgba(3,27,22,0.46)_0%,rgba(3,27,22,0.16)_40%,transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(180deg,transparent_0%,rgba(3,27,22,0.84)_78%,#031B16_100%)]" />

      <div className="relative flex min-h-[100svh] flex-col justify-end px-6 pb-[calc(2.25rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
        <div className="cradle-hero-copy max-w-[340px] [text-shadow:0_2px_22px_rgba(4,17,12,0.72)]">
          <p className="cradle-hero-fade text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D4B57A] [font-family:var(--sp-font-body)]">
            {brandEyebrow}
          </p>
          <h1 className="cradle-hero-fade mt-4 text-[42px] font-semibold leading-[0.98] text-[#F6EBD6] [font-family:var(--sp-font-accent)] min-[390px]:text-[52px] min-[420px]:text-[58px]">
            {title.includes("\n")
              ? title.split("\n").map((line, idx) => (
                  <span key={idx}>
                    {line}
                    {idx < title.split("\n").length - 1 && <br />}
                  </span>
                ))
              : title}
          </h1>
          <div className="cradle-hero-fade mt-5 h-px w-16 bg-[#C8A96A]" />
          <p className="cradle-hero-fade mt-5 max-w-[315px] text-[14px] leading-[1.6] text-[#F6EBD6]/86 [font-family:var(--sp-font-body)] sm:text-[15px]">
            {subtitle}
          </p>

          <div className="cradle-hero-fade mt-8 flex w-fit max-w-[92vw] items-center gap-2.5 min-[390px]:gap-3">
            <Link
              href={ctaHref}
              className="inline-flex h-11 min-w-[146px] items-center justify-center rounded-full bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#031B16] shadow-[0_12px_28px_rgba(200,169,106,0.22)] transition-transform active:scale-[0.98] [font-family:var(--sp-font-body)] min-[390px]:min-w-[154px] min-[390px]:text-[0.65rem] min-[390px]:tracking-[0.16em]"
            >
              {ctaLabel}
            </Link>
            <Link
              href={secondaryCtaHref}
              className="inline-flex h-11 min-w-[128px] items-center justify-center rounded-full border border-[#D4B57A]/55 bg-[#031B16]/45 px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#F6EBD6] backdrop-blur-md transition-colors active:bg-white/10 [font-family:var(--sp-font-body)] min-[390px]:min-w-[138px] min-[390px]:text-[0.65rem] min-[390px]:tracking-[0.16em]"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
