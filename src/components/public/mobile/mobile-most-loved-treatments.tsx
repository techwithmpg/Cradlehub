import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
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
            Guest favorites
          </p>
          <MobileScrollFloatHeading text="Most-Loved Treatments" />
        </div>
        <Link
          href="/services"
          className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8A96A]"
        >
          View All
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {services.map((service, index) => (
          <MobileFadeUp key={service.id} className="w-[172px] shrink-0">
            <article className="overflow-hidden rounded-[24px] border border-[#C8A96A]/18 bg-[#F3E9D2] shadow-[0_16px_38px_rgba(0,0,0,0.18)]">
              <div className="relative h-[118px]">
                <ServiceImage
                  src={service.imageUrl}
                  alt={service.imageAlt}
                  fill
                  className="object-cover"
                  sizes="172px"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,17,12,0.64)_0%,rgba(4,17,12,0.08)_70%)]" />
                {index === 0 ? (
                  <span className="absolute left-3 top-3 rounded-full bg-[#C8A96A] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#061912]">
                    Best Seller
                  </span>
                ) : null}
              </div>
              <div className="p-3.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9A6A1F]">
                  {service.categoryName.replace(" Services", "")}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-[34px] text-[14px] font-semibold leading-[1.2] text-[#0D2B20]">
                  {service.name}
                </h3>
                <p className="mt-1 text-[10px] text-[#5F6F63]">
                  {service.durationText}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#9A6A1F]">
                    {service.priceLabel}
                  </p>
                  <Link
                    href="/book"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D2B20] text-[#C8A96A] shadow-[0_8px_18px_rgba(13,43,32,0.25)]"
                    aria-label={`Book ${service.name}`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
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
