"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Flower2,
  Gem,
  MessageCircle,
  Scissors,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import type { PublicCatalogService } from "@/lib/queries/services";
import {
  PUBLIC_CATALOG_CATEGORY_DETAILS,
  PUBLIC_CATALOG_CATEGORY_NAMES,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";

const INITIAL_VISIBLE_COUNT = 5;

const categoryIcons: Record<PublicCatalogCategoryName, LucideIcon> = {
  "Massage Services": Flower2,
  "Salon Services": Scissors,
  "Skin Care Services": Sparkles,
  "Divine Renewal Packages": Gem,
  "Spa Party Packages": Users,
};

function serviceAction(service: PublicCatalogService) {
  if (service.isPublicBookable && !service.requiresConsultation) {
    return { href: "/book", label: "Book", Icon: CalendarDays };
  }
  return { href: "/contact", label: "Inquire", Icon: MessageCircle };
}

export function PublicMobileServices({ services }: { services: PublicCatalogService[] }) {
  const categories = useMemo(
    () =>
      PUBLIC_CATALOG_CATEGORY_NAMES.filter((category) =>
        services.some((service) => service.categoryName === category)
      ),
    [services]
  );
  const [selectedCategory, setSelectedCategory] = useState<PublicCatalogCategoryName>(
    categories[0] ?? "Massage Services"
  );
  const [expanded, setExpanded] = useState(false);

  const visibleServices = services.filter(
    (service) => service.categoryName === selectedCategory
  );
  const listedServices = expanded
    ? visibleServices
    : visibleServices.slice(0, INITIAL_VISIBLE_COUNT);
  const categoryDetails = PUBLIC_CATALOG_CATEGORY_DETAILS[selectedCategory];

  return (
    <div className="md:hidden bg-[#FBF6EC] pb-12 pt-14 text-[#10261D]">
      <section className="relative h-[214px] overflow-hidden bg-[#10261D]">
        <Image
          src={SPA_IMAGES.ctaBanner}
          alt="Cradle wellness service details"
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#10261D]/54" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 text-[#FCFAF5]">
          <h1
            className="text-[30px] font-medium leading-tight"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Our Services
          </h1>
          <p className="mt-3 max-w-[265px] text-[13px] leading-6 text-[#FCFAF5]/84">
            Discover our full range of services crafted for your wellness.
          </p>
        </div>
      </section>

      <section className="px-4 py-5">
        <h2 className="text-[15px] font-semibold">Categories</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => {
            const details = PUBLIC_CATALOG_CATEGORY_DETAILS[category];
            const active = selectedCategory === category;
            const CategoryIcon = categoryIcons[category];
            return (
              <button
                type="button"
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setExpanded(false);
                }}
                className={[
                  "flex min-h-[58px] min-w-[70px] shrink-0 flex-col items-center justify-center gap-1 rounded-[7px] border px-3 py-2 text-[10.5px] font-semibold transition",
                  active
                    ? "border-[#063D2D] bg-[#063D2D] text-[#FCFAF5]"
                    : "border-[#E9DDC8] bg-[#FCFAF5] text-[#10261D]",
                ].join(" ")}
              >
                <CategoryIcon
                  className={active ? "h-4 w-4 text-[#C8A96B]" : "h-4 w-4 text-[#8A6B35]"}
                  aria-hidden="true"
                />
                {details.shortName}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-4 pb-6">
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-[#E8DDCA] pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B68A3C]">
              {categoryDetails.eyebrow}
            </p>
            <h2 className="mt-1 text-[19px] font-semibold">{selectedCategory}</h2>
          </div>
          <p className="text-[11px] font-medium text-[#7A6B58]">
            {visibleServices.length} items
          </p>
        </div>

        <div className="space-y-3">
          {listedServices.length > 0 ? (
            listedServices.map((service) => {
              const action = serviceAction(service);
              const ActionIcon = action.Icon;
              return (
                <article
                  key={service.id}
                  className="grid grid-cols-[72px_1fr_auto] gap-3 border-b border-[#E8DDCA] pb-3"
                >
                  <div className="relative h-[72px] overflow-hidden rounded-[7px] bg-[#E9DDC8]">
                    <Image
                      src={categoryDetails.image}
                      alt={`${service.name} at Cradle`}
                      fill
                      className="object-cover"
                      sizes="72px"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-[13px] font-semibold">{service.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-[#5F6F63]">
                      {service.shortDescription}
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-[#7A6B58]">
                      {service.durationText}
                    </p>
                  </div>
                  <div className="flex min-w-[66px] flex-col items-end justify-between">
                    <p className="text-[12px] font-semibold text-[#9A6A1F]">
                      {service.priceLabel}
                    </p>
                    <Link
                      href={action.href}
                      className="inline-flex min-h-8 items-center gap-1 rounded-[5px] bg-[#063D2D] px-2 text-[9.5px] font-semibold uppercase text-[#FCFAF5]"
                    >
                      <ActionIcon className="h-3 w-3" aria-hidden="true" />
                      {action.label}
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[10px] border border-[#E8DDCA] bg-white p-5 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-[#B68A3C]" aria-hidden="true" />
              <p className="mt-2 text-[13px] font-semibold">Services are being updated.</p>
              <p className="mt-1 text-[11px] leading-5 text-[#5F6F63]">
                Please contact the front desk for the latest available treatments.
              </p>
            </div>
          )}
        </div>

        {visibleServices.length > listedServices.length && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-[7px] border border-[#D8C8AA] text-[12px] font-semibold uppercase tracking-[0.12em]"
          >
            View All {PUBLIC_CATALOG_CATEGORY_DETAILS[selectedCategory].shortName} Services
          </button>
        )}
      </section>
    </div>
  );
}
