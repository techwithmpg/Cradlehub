"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  MessageCircle,
  Phone,
  Sparkles,
  Store,
} from "lucide-react";
import { ServiceImage } from "@/components/public/service-image";
import type { PublicCatalogService } from "@/lib/queries/services";
import {
  PUBLIC_CATALOG_CATEGORY_DETAILS,
  PUBLIC_CATALOG_CATEGORY_NAMES,
  PUBLIC_CATALOG_SUBCATEGORY_ORDER,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";

type Props = {
  services: PublicCatalogService[];
};

type GroupedCategory = {
  name: string;
  services: PublicCatalogService[];
};

const INITIAL_CATEGORY_LIMIT = 8;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function categoryOrder(name: string) {
  const index = PUBLIC_CATALOG_CATEGORY_NAMES.indexOf(name as PublicCatalogCategoryName);
  return index === -1 ? 99 : index;
}

function subcategoryOrder(name: string) {
  const index = PUBLIC_CATALOG_SUBCATEGORY_ORDER.indexOf(
    name as (typeof PUBLIC_CATALOG_SUBCATEGORY_ORDER)[number]
  );
  return index === -1 ? 99 : index;
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildBadges(service: PublicCatalogService) {
  return uniqueItems([
    service.availableInSpa ? "In-spa" : "",
    service.availableHomeService ? "Home Service" : "",
    service.isCsrOnly ? "CSR Only" : "",
    service.isVip ? "VIP" : "",
    service.isCatalogOnly ? "Contact to book" : "",
    service.requiresConsultation ? "Consultation" : "",
    service.categoryName.includes("Package") ? "Package" : "",
    ...service.badges.slice(0, 3),
  ]).slice(0, 5);
}

function serviceCta(service: PublicCatalogService) {
  if (service.isPublicBookable && !service.requiresConsultation) {
    return { href: "/book", label: "Book", Icon: CalendarDays };
  }
  return { href: "/contact", label: "Inquire", Icon: MessageCircle };
}

function groupServices(services: PublicCatalogService[]): GroupedCategory[] {
  const byCategory = new Map<string, PublicCatalogService[]>();
  for (const service of services) {
    const rows = byCategory.get(service.categoryName) ?? [];
    rows.push(service);
    byCategory.set(service.categoryName, rows);
  }

  return Array.from(byCategory.entries())
    .map(([name, rows]) => ({
      name,
      services: rows.sort((a, b) => {
        const subcategoryDelta =
          subcategoryOrder(a.subcategory) - subcategoryOrder(b.subcategory);
        if (subcategoryDelta !== 0) return subcategoryDelta;
        const priceDelta = a.price - b.price;
        if (priceDelta !== 0) return priceDelta;
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => categoryOrder(a.name) - categoryOrder(b.name));
}

function subgroupServices(services: PublicCatalogService[]) {
  const bySubcategory = new Map<string, PublicCatalogService[]>();
  for (const service of services) {
    const rows = bySubcategory.get(service.subcategory) ?? [];
    rows.push(service);
    bySubcategory.set(service.subcategory, rows);
  }
  return Array.from(bySubcategory.entries()).sort(
    ([a], [b]) => subcategoryOrder(a) - subcategoryOrder(b)
  );
}

export function ServiceCatalogClient({ services }: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const groupedCategories = useMemo(() => groupServices(services), [services]);

  if (groupedCategories.length === 0) {
    return (
      <section className="bg-[#FCFAF5] px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-[8px] border border-[#EDE4D3] bg-[#F7F3EB] p-8 text-center">
          <h2
            className="text-2xl font-medium text-[#163A2B]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Services are being prepared.
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-[#6B7A6F]">
            Please check back soon or contact the front desk for the latest Cradle menu.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#FCFAF5] py-14 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[260px_1fr] lg:px-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[8px] border border-[#EDE4D3] bg-[#F7F3EB] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B68A3C]">
              Browse Menu
            </p>
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {groupedCategories.map((category) => {
                const details =
                  PUBLIC_CATALOG_CATEGORY_DETAILS[category.name as PublicCatalogCategoryName];
                return (
                  <a
                    key={category.name}
                    href={`#${slugify(category.name)}`}
                    className="inline-flex shrink-0 items-center justify-between gap-4 rounded-[8px] border border-[#EDE4D3] bg-white px-4 py-3 text-left transition hover:border-[#C8A96B] hover:bg-[#FCFAF5] lg:w-full"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-[#163A2B]">
                        {details?.shortName ?? category.name}
                      </span>
                      <span className="block text-[11px] text-[#6B7A6F]">
                        {category.services.length} services
                      </span>
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C8A96B]" />
                  </a>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-16">
          {groupedCategories.map((category) => {
            const details =
              PUBLIC_CATALOG_CATEGORY_DETAILS[category.name as PublicCatalogCategoryName];
            const categoryId = slugify(category.name);
            const isExpanded = expandedCategories.has(category.name);
            const visibleServices = isExpanded
              ? category.services
              : category.services.slice(0, INITIAL_CATEGORY_LIMIT);
            const hiddenCount = category.services.length - visibleServices.length;

            return (
              <section key={category.name} id={categoryId} className="scroll-mt-28">
                <div className="mb-7 border-b border-[#EDE4D3] pb-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#B68A3C]">
                    {details?.eyebrow ?? "Cradle Menu"}
                  </p>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <h2
                        className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
                        style={{ fontFamily: "var(--sp-font-display)" }}
                      >
                        {category.name}
                      </h2>
                      <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#6B7A6F]">
                        {details?.description ??
                          "Cradle services grouped for easier browsing and booking decisions."}
                      </p>
                    </div>
                    <div className="rounded-full border border-[#EDE4D3] bg-[#F7F3EB] px-4 py-2 text-[12px] font-semibold text-[#5F6F63]">
                      {category.services.length} menu items
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {subgroupServices(visibleServices).map(([subcategory, rows]) => (
                    <div key={subcategory}>
                      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#B68A3C]">
                        {subcategory}
                      </h3>
                      <div className="overflow-hidden rounded-[8px] border border-[#EDE4D3] bg-white">
                        {rows.map((service, index) => {
                          const cta = serviceCta(service);
                          const Icon = cta.Icon;
                          const badges = buildBadges(service);
                          return (
                            <article
                              key={service.id}
                              className={`grid gap-4 p-4 sm:grid-cols-[112px_1fr_auto] sm:items-center sm:p-5 ${
                                index < rows.length - 1 ? "border-b border-[#EDE4D3]" : ""
                              }`}
                            >
                              <div className="relative aspect-[3/2] overflow-hidden rounded-[8px] bg-[#E9DDC8]">
                                <ServiceImage
                                  src={service.imageUrl}
                                  alt={service.imageAlt}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 100vw, 112px"
                                />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-[15px] font-semibold text-[#163A2B]">
                                    {service.name}
                                  </h4>
                                  {service.packagePax && (
                                    <span className="rounded-full bg-[#F7F3EB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A5A24]">
                                      {service.packagePax} pax
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[13px] leading-6 text-[#6B7A6F]">
                                  {service.shortDescription}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {badges.map((badge) => (
                                    <span
                                      key={badge}
                                      className="inline-flex items-center rounded-full border border-[#EDE4D3] bg-[#FCFAF5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5F6F63]"
                                    >
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-4 sm:min-w-52 sm:justify-end">
                                <div className="text-right">
                                  <p className="text-[15px] font-semibold text-[#163A2B]">
                                    {service.priceLabel}
                                  </p>
                                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9AA89A]">
                                    {service.packageDurationText || service.durationText}
                                  </p>
                                </div>
                                <Link
                                  href={cta.href}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#C8A96B] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#163A2B] transition hover:bg-[#F7F3EB]"
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                  {cta.label}
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {hiddenCount > 0 && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories((current) => {
                          const next = new Set(current);
                          next.add(category.name);
                          return next;
                        })
                      }
                      className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#163A2B] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#FCFAF5] transition hover:bg-[#214F3B]"
                    >
                      Show {hiddenCount} more
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-6 lg:px-12">
        <div className="grid gap-4 rounded-[8px] bg-[#10261D] p-6 text-[#FCFAF5] md:grid-cols-[1fr_auto] md:items-center lg:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E8D5A3]">
              Not sure what to choose?
            </p>
            <h2
              className="mt-3 text-2xl font-medium"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              The front desk can help match your visit to the right service.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/book"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#C8A96B] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#10261D] transition hover:bg-[#E8D5A3]"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              Book Appointment
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#F7F3EB]/24 px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#FCFAF5] transition hover:bg-white/10"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Contact Cradle
            </Link>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[12px] leading-5 text-[#6B7A6F]">
          <Sparkles className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
          Catalog services are shown for browsing. Booking availability still depends on branch,
          visit type, service visibility, and daily operations settings.
        </p>
      </div>
    </section>
  );
}
