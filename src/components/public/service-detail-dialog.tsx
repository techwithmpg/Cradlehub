"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Home, Sparkles, X } from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import { ServiceImage } from "@/components/public/service-image";

export function ServiceDetailDialog({
  service,
  bookingHref,
  onClose,
}: {
  service: PublicCatalogService | null;
  bookingHref: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (service) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }, [service]);

  if (!service) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${service.name} details`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(94vw,38rem)] overflow-hidden rounded-3xl border border-[#DDD4C2] bg-[#FCFAF5] p-0 text-[#10261D] shadow-2xl backdrop:bg-[#10261D]/60 backdrop:backdrop-blur-xs"
    >
      <div className="relative h-56 w-full bg-[#EDE4D3] sm:h-64">
        <ServiceImage
          src={service.imageUrl}
          alt={service.imageAlt || service.name}
          category={service.categoryName}
          fill
          sizes="(max-width: 640px) 94vw, 608px"
          className="object-cover"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close service details"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#10261D]/80 text-[#FAF5E9] backdrop-blur-xs transition hover:bg-[#10261D]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="absolute bottom-3 left-4 rounded-full bg-[#10261D]/85 px-3 py-1 text-[11px] font-semibold tracking-wider text-[#E8D5A3] uppercase backdrop-blur-xs">
          {service.categoryName}
        </span>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              {service.name}
            </h2>
            {service.subcategory && (
              <p className="mt-0.5 text-xs text-[#6B766F]">
                {service.subcategory}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-[#163A2B]">
              {service.priceLabel}
            </p>
            <p className="inline-flex items-center gap-1 text-xs text-[#58665E]">
              <Clock className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
              <span>{service.packageDurationText || service.durationText}</span>
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#414F47]">
          {service.description}
        </p>

        {service.inclusions && service.inclusions.length > 0 && (
          <div className="rounded-2xl border border-[#E5DEC9] bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#8A6D3B] uppercase">
              Included in This Treatment
            </p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {service.inclusions.map((inc, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-[#2E3C34]"
                >
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#163A2B]"
                    aria-hidden="true"
                  />
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[11px]">
          {service.availableInSpa && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF2ED] px-3 py-1 font-medium text-[#163A2B]">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              In-Spa Suite Available
            </span>
          )}
          {service.availableHomeService && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EFE3] px-3 py-1 font-medium text-[#7D5E29]">
              <Home className="h-3 w-3" aria-hidden="true" />
              Home Service Available
            </span>
          )}
          {service.requiresConsultation && (
            <span className="rounded-full bg-[#F5EFE3] px-3 py-1 font-medium text-[#7D5E29]">
              Consultation Recommended
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E5DEC9] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#D7CEBC] px-5 py-2.5 text-xs font-semibold text-[#3B4840] transition hover:bg-[#EDE4D3]"
          >
            Close
          </button>
          <Link
            href={bookingHref}
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full bg-[#163A2B] px-6 py-2.5 text-xs font-semibold text-[#FAF5E9] shadow-xs transition hover:bg-[#1E4D3A]"
          >
            <span>Book This Treatment</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </dialog>
  );
}
