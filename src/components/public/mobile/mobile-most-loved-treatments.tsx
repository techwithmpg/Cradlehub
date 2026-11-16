import React from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
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
    <section className="px-4 py-7 text-[#FAF5E9]">
      <div className="mx-auto max-w-md">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#E5C98B] uppercase">
              Curated Care
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
              Popular Treatments
            </h2>
          </div>
          <Link
            href="/services"
            className="text-xs font-semibold text-[#E8D5A3] hover:underline"
          >
            All Services →
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {services.slice(0, 4).map((service) => (
            <div
              key={service.id}
              className="eg-glass-card flex items-center gap-3 rounded-2xl p-3"
            >
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#0A251B]">
                <img
                  src={service.imageUrl}
                  alt={service.imageAlt || service.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-sm font-semibold text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                  {service.name}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#CBD6CD]">
                  {service.description}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-[#CBD6CD]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#E5C98B]" aria-hidden="true" />
                      <span>{service.durationText}</span>
                    </span>
                    <span className="font-bold text-[#E8D5A3] tabular-nums">
                      {service.priceLabel}
                    </span>
                  </div>
                  <Link
                    href={`/book?serviceId=${encodeURIComponent(service.id)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#D4B57A] px-3 py-1.5 text-[11px] font-semibold text-[#071A12]"
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
