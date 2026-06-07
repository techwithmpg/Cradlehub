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
              className={`sticky ${STACK_CLASSES[index]} min-h-[548px] overflow-hidden rounded-[30px] border border-[#C8A96A]/24 bg-[#05241D] shadow-[0_28px_72px_rgba(0,0,0,0.36)]`}
            >
              <div className="absolute inset-0">
                <Image
                  src={ritual.image}
                  alt={ritual.title}
                  fill
                  className="object-cover"
                  sizes="calc(100vw - 32px)"
                />
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(200,169,106,0.16)_0%,transparent_46%),linear-gradient(to_bottom,rgba(3,27,22,0.18)_0%,rgba(3,27,22,0.38)_48%,rgba(3,27,22,0.96)_100%)]" />
              <div className="relative flex min-h-[548px] flex-col justify-end p-5">
                <span className="absolute left-4 top-4 rounded-full border border-[#C8A96A]/32 bg-[#061912]/55 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#F3E9D2] backdrop-blur-md">
                  {ritual.bestFor}
                </span>
                <div className="rounded-[26px] border border-[#C8A96A]/20 bg-[#0D2B20]/58 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                  <div className="mb-4 inline-flex rounded-full border border-[#C8A96A]/42 bg-[#061912]/40 px-3 py-1 text-[10px] font-bold text-[#D4B57A]">
                    {ritual.price}
                  </div>
                  <div>
                    <h3 className="text-[34px] font-medium leading-none text-[#F5ECDD] [font-family:var(--sp-font-accent)]">
                      {ritual.title}
                    </h3>
                    <p className="mt-3 text-[12px] leading-6 text-[#EFE3CF]/76">
                      {ritual.description}
                    </p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A]/90">
                      {ritual.duration}
                    </p>
                  </div>
                  <Link
                    href="/book"
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#C8A96A]/50 bg-[#061912]/48 px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4B57A] shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md"
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Book Ritual
                  </Link>
                </div>
              </div>
            </article>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
