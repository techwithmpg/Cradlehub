import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
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
    image: "/images/spa/home/ritual-glow.jpg",
    imageClassName: "object-[center_42%]",
    sideGradientClassName:
      "bg-[linear-gradient(90deg,rgba(3,27,22,0.9)_0%,rgba(3,27,22,0.68)_42%,rgba(3,27,22,0.18)_76%,rgba(3,27,22,0.04)_100%)]",
    warmGlowClassName:
      "bg-[radial-gradient(circle_at_78%_24%,rgba(212,181,122,0.16)_0%,transparent_36%)]",
    textStackClassName: "items-start text-left",
    description:
      "A luminous care sequence for guests who want to feel refreshed, polished, and gently restored.",
  },
  {
    title: "Recovery Ritual",
    bestFor: "Best for tired bodies",
    image: "/images/spa/home/ritual-recovery.jpg",
    imageClassName: "object-[center_35%]",
    sideGradientClassName:
      "bg-[linear-gradient(90deg,rgba(3,27,22,0.88)_0%,rgba(3,27,22,0.64)_40%,rgba(3,27,22,0.18)_74%,rgba(3,27,22,0.04)_100%)]",
    warmGlowClassName:
      "bg-[radial-gradient(circle_at_76%_18%,rgba(212,181,122,0.14)_0%,transparent_34%)]",
    textStackClassName: "items-start text-left",
    description:
      "A deeper recovery path for tension, long weeks, and bodies asking for calm pressure.",
  },
  {
    title: "Full Reset Ritual",
    bestFor: "Best for unhurried care",
    image: "/images/spa/home/ritual-full-reset.jpg",
    imageClassName: "object-[center_55%]",
    sideGradientClassName:
      "bg-[linear-gradient(270deg,rgba(3,27,22,0.9)_0%,rgba(3,27,22,0.68)_42%,rgba(3,27,22,0.18)_76%,rgba(3,27,22,0.04)_100%)]",
    warmGlowClassName:
      "bg-[radial-gradient(circle_at_22%_24%,rgba(212,181,122,0.16)_0%,transparent_36%)]",
    textStackClassName: "ml-auto items-end text-right",
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
              className={`sticky ${STACK_CLASSES[index]} relative min-h-[470px] overflow-hidden rounded-[2.25rem] border border-[#D4B57A]/24 bg-[#031B16] shadow-[0_28px_80px_rgba(0,0,0,0.35)]`}
            >
              <div className="absolute inset-0">
                <Image
                  src={ritual.image}
                  alt={ritual.title}
                  fill
                  className={`object-cover ${ritual.imageClassName}`}
                  sizes="calc(100vw - 32px)"
                />
              </div>
              <div className={`absolute inset-0 ${ritual.sideGradientClassName}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,27,22,0.06)_0%,rgba(3,27,22,0.14)_45%,rgba(3,27,22,0.78)_100%)]" />
              <div className={`absolute inset-0 ${ritual.warmGlowClassName}`} />
              <div className="relative z-10 flex min-h-[470px] flex-col p-6">
                <span className="w-fit rounded-full border border-[#D4B57A]/35 bg-[#031B16]/55 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F6EBD6] shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-md">
                  {ritual.bestFor}
                </span>
                <div
                  className={`mt-auto flex max-w-[74%] flex-col gap-4 ${ritual.textStackClassName} [text-shadow:0_2px_18px_rgba(4,17,12,0.78)]`}
                >
                  <div className="inline-flex w-fit rounded-full border border-[#D4B57A]/35 bg-[#031B16]/55 px-3 py-1 text-[10px] font-bold text-[#D4B57A] shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-md">
                    {ritual.price}
                  </div>
                  <div>
                    <h3 className="text-[36px] font-medium leading-[0.98] text-[#F6EBD6] [font-family:var(--sp-font-accent)]">
                      {ritual.title}
                    </h3>
                    <p className="mt-3 text-[13px] leading-6 text-[#F6EBD6]/82">
                      {ritual.description}
                    </p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4B57A]/95">
                      {ritual.duration}
                    </p>
                  </div>
                  <Link
                    href="/book"
                    className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#031B16] shadow-[0_18px_42px_rgba(200,169,106,0.24)] transition-transform active:scale-[0.98]"
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
