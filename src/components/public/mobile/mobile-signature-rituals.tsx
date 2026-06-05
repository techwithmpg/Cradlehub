import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import type { PublicCatalogService } from "@/lib/queries/services";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

type MobileSignatureRitualsProps = {
  services: PublicCatalogService[];
};

const STACK_CLASSES = [
  "top-[76px] scale-[0.92]",
  "top-[92px] scale-[0.935]",
  "top-[108px] scale-[0.95]",
] as const;

const RITUAL_BLUEPRINTS = [
  {
    title: "Glow Ritual",
    bestFor: "Best for a soft reset",
    image: SPA_IMAGES.heroSupportingMassage,
    description:
      "A luminous care sequence for guests who want to feel refreshed, polished, and gently restored.",
  },
  {
    title: "Recovery Ritual",
    bestFor: "Best for tired bodies",
    image: SPA_IMAGES.heroMobile,
    description:
      "A deeper recovery path for tension, long weeks, and bodies asking for calm pressure.",
  },
  {
    title: "Full Reset Ritual",
    bestFor: "Best for unhurried care",
    image: SPA_IMAGES.heroWide,
    description:
      "A longer Cradle visit that turns massage, atmosphere, and quiet details into a complete pause.",
  },
] as const;

function resolvePackageServices(services: PublicCatalogService[]) {
  const packageServices = services.filter(
    (service) =>
      service.categoryName === "Divine Renewal Packages" ||
      service.categoryName === "Spa Party Packages"
  );

  return RITUAL_BLUEPRINTS.map((blueprint, index) => {
    const service = packageServices[index] ?? packageServices[0] ?? null;
    return {
      ...blueprint,
      duration:
        service?.packageDurationText ?? service?.durationText ?? "Curated session",
      price: service?.priceLabel ?? "See menu",
    };
  });
}

export function MobileSignatureRituals({
  services,
}: MobileSignatureRitualsProps) {
  const rituals = resolvePackageServices(services);

  return (
    <section className="px-4 pt-12">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          Signature Rituals
        </p>
        <MobileScrollFloatHeading text="More than a treatment. A complete experience." />
      </div>

      <div className="space-y-5">
        {rituals.map((ritual, index) => (
          <MobileFadeUp key={ritual.title}>
            <article
              className={`sticky ${STACK_CLASSES[index]} overflow-hidden rounded-[30px] border border-[#C8A96A]/22 bg-[#F3E9D2] shadow-[0_24px_60px_rgba(0,0,0,0.28)]`}
            >
              <div className="relative h-[220px] overflow-hidden">
                <Image
                  src={ritual.image}
                  alt={ritual.title}
                  fill
                  className="object-cover"
                  sizes="calc(100vw - 32px)"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,17,12,0.78)_0%,rgba(4,17,12,0.16)_66%,rgba(4,17,12,0)_100%)]" />
                <span className="absolute left-4 top-4 rounded-full border border-[#C8A96A]/32 bg-[#061912]/55 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#F3E9D2] backdrop-blur-md">
                  {ritual.bestFor}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[30px] font-medium leading-none text-[#0D2B20] [font-family:var(--sp-font-accent)]">
                      {ritual.title}
                    </h3>
                    <p className="mt-3 text-[12px] leading-6 text-[#405448]">
                      {ritual.description}
                    </p>
                  </div>
                  <div className="min-w-[82px] rounded-2xl border border-[#D6BE81]/45 bg-[#FFF8E9] px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold text-[#5F6F63]">
                      {ritual.duration}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-[#9A6A1F]">
                      {ritual.price}
                    </p>
                  </div>
                </div>
                <Link
                  href="/book"
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0D2B20] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8A96A] shadow-[0_14px_30px_rgba(13,43,32,0.26)]"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Book Ritual
                </Link>
              </div>
            </article>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
