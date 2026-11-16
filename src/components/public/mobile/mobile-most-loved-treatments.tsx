import React from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { ServiceImage } from "@/components/public/service-image";
import type { PublicCatalogService } from "@/lib/queries/services";

type MobileMostLovedTreatmentsProps = {
  services: PublicCatalogService[];
};

export function MobileMostLovedTreatments({
  services,
}: MobileMostLovedTreatmentsProps) {
  if (!services || services.length === 0) {
    return null;
  }

  return (
    <section className="bg-[#FCFAF5] px-4 py-7 text-[#10261D]">
      <div className="mx-auto max-w-md">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
              Curated Care
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Popular Treatments
            </h2>
          </div>
          <Link
            href="/services"
            className="text-xs font-semibold text-[#163A2B] hover:underline"
          >
            All Services →
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {services.slice(0, 4).map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-3 rounded-2xl border border-[#E5DEC9] bg-white p-3 shadow-xs"
            >
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EDE4D3]">
                <ServiceImage
                  src={service.imageUrl}
                  alt={service.imageAlt || service.name}
                  fill
                  sizes="96px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-sm font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
                  {service.name}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#58665E]">
                  {service.description}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-[#4C5A52]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#B68A3C]" aria-hidden="true" />
                      <span>{service.durationText}</span>
                    </span>
                    <span className="font-bold text-[#10261D]">
                      {service.priceLabel}
                    </span>
                  </div>
                  <Link
                    href={`/book?serviceId=${encodeURIComponent(service.id)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#163A2B] px-3 py-1.5 text-[11px] font-semibold text-[#FAF5E9]"
                  >
                    <span>Book</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
