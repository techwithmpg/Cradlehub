import Link from "next/link";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { ServiceImage } from "@/components/public/service-image";
import type { PublicCatalogService } from "@/lib/queries/services";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

type MobileMostLovedTreatmentsProps = {
  services: PublicCatalogService[];
};

export function MobileMostLovedTreatments({
  services,
}: MobileMostLovedTreatmentsProps) {
  if (services.length === 0) return null;

  return (
    <section className="px-4 pt-11">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
            Guest Favorites
          </p>
          <MobileScrollFloatHeading text="Most-Loved Treatments" />
        </div>
        <Link
          href="/services"
          className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8A96A]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {services.map((service, index) => (
          <MobileFadeUp key={service.id} className="w-[174px] shrink-0">
            <article className="relative min-h-[334px] overflow-hidden rounded-[26px] border border-[#C8A96A]/22 bg-[#05241D] shadow-[0_20px_48px_rgba(0,0,0,0.3)]">
              <ServiceImage
                src={service.imageUrl}
                alt={service.imageAlt}
                fill
                className="object-cover"
                sizes="174px"
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,27,22,0.16)_0%,rgba(3,27,22,0.1)_42%,rgba(3,27,22,0.94)_100%)]" />
              {index === 0 ? (
                <span className="absolute left-3 top-3 rounded-full bg-[#C8A96A] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#061912] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                  Best Seller
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A]">
                  {service.categoryName.replace(" Services", "")}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-[48px] text-[24px] font-medium leading-none text-[#F5ECDD] [font-family:var(--sp-font-accent)]">
                  {service.name}
                </h3>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="inline-flex items-center gap-1 text-[10px] text-[#EFE3CF]/74">
                      <CalendarDays className="h-3 w-3 text-[#C8A96A]" aria-hidden="true" />
                      {service.durationText}
                    </p>
                    <p className="mt-2 text-[12px] font-bold text-[#D4B57A]">
                      {service.priceLabel}
                    </p>
                  </div>
                  <Link
                    href="/book"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C8A96A]/52 bg-[#061912]/58 text-[#D4B57A] shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-md"
                    aria-label={`Book ${service.name}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
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
