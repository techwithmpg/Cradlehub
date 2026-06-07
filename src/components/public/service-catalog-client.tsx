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
const DARK_PAGE_SURFACE =
  "bg-[radial-gradient(circle_at_80%_8%,rgba(212,181,122,0.10),transparent_34%),linear-gradient(180deg,#031B16_0%,#05241D_50%,#02140F_100%)]";
const DARK_GLASS_CARD =
  "border border-[#D4B57A]/22 bg-[#0D2B20]/70 shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(246,235,214,0.06)] backdrop-blur-xl";

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
      <section className={`${DARK_PAGE_SURFACE} px-6 py-20`}>
        <div className={`mx-auto max-w-3xl rounded-[8px] p-8 text-center ${DARK_GLASS_CARD}`}>
          <h2
            className="text-2xl font-medium text-[#F6EBD6]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Services are being prepared.
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-[#F6EBD6]/68">
            Please check back soon or contact the front desk for the latest Cradle menu.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${DARK_PAGE_SURFACE} py-14 lg:py-20`}>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[260px_1fr] lg:px-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className={`rounded-[8px] p-4 ${DARK_GLASS_CARD}`}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4B57A]">
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
                    className="inline-flex shrink-0 items-center justify-between gap-4 rounded-[8px] border border-[#D4B57A]/20 bg-[#05241D]/75 px-4 py-3 text-left transition hover:border-[#D4B57A]/55 hover:bg-[#0D2B20] lg:w-full"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-[#F6EBD6]">
                        {details?.shortName ?? category.name}
                      </span>
                      <span className="block text-[11px] text-[#F6EBD6]/62">
                        {category.services.length} services
                      </span>
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4B57A]" />
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
                <div className="mb-7 border-b border-[#D4B57A]/20 pb-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#D4B57A]">
                    {details?.eyebrow ?? "Cradle Menu"}
                  </p>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                      <h2
                        className="text-3xl font-medium leading-tight text-[#F6EBD6] sm:text-4xl"
                        style={{ fontFamily: "var(--sp-font-display)" }}
                      >
                        {category.name}
                      </h2>
                      <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#F6EBD6]/68">
                        {details?.description ??
                          "Cradle services grouped for easier browsing and booking decisions."}
                      </p>
                    </div>
                    <div className="rounded-full border border-[#D4B57A]/24 bg-[#05241D]/72 px-4 py-2 text-[12px] font-semibold text-[#F6EBD6]/72">
                      {category.services.length} menu items
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {subgroupServices(visibleServices).map(([subcategory, rows]) => (
                    <div key={subcategory}>
                      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#D4B57A]">
                        {subcategory}
                      </h3>
                      <div className={`overflow-hidden rounded-[8px] ${DARK_GLASS_CARD}`}>
                        {rows.map((service, index) => {
                          const cta = serviceCta(service);
                          const Icon = cta.Icon;
                          const badges = buildBadges(service);
                          return (
                            <article
                              key={service.id}
                              className={`grid gap-4 p-4 sm:grid-cols-[112px_1fr_auto] sm:items-center sm:p-5 ${
                                index < rows.length - 1 ? "border-b border-[#D4B57A]/14" : ""
                              }`}
                            >
                              <div className="relative aspect-[3/2] overflow-hidden rounded-[8px] bg-[#031B16]">
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
                                  <h4 className="text-[15px] font-semibold text-[#F6EBD6]">
                                    {service.name}
                                  </h4>
                                  {service.packagePax && (
                                    <span className="rounded-full border border-[#D4B57A]/20 bg-[#D4B57A]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4B57A]">
                                      {service.packagePax} pax
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[13px] leading-6 text-[#F6EBD6]/66">
                                  {service.shortDescription}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {badges.map((badge) => (
                                    <span
                                      key={badge}
                                      className="inline-flex items-center rounded-full border border-[#D4B57A]/18 bg-[#05241D]/78 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#F6EBD6]/64"
                                    >
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-4 sm:min-w-52 sm:justify-end">
                                <div className="text-right">
                                  <p className="text-[15px] font-semibold text-[#D4B57A]">
                                    {service.priceLabel}
                                  </p>
                                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F6EBD6]/52">
                                    {service.packageDurationText || service.durationText}
                                  </p>
                                </div>
                                <Link
                                  href={cta.href}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D4B57A]/44 bg-[#05241D]/72 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F6EBD6] transition hover:border-[#D4B57A] hover:bg-[#D4B57A]/10"
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
                      className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#031B16] transition hover:opacity-90"
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
        <div className={`grid gap-4 rounded-[8px] p-6 text-[#F6EBD6] md:grid-cols-[1fr_auto] md:items-center lg:p-8 ${DARK_GLASS_CARD}`}>
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#D4B57A] via-[#C8A96A] to-[#B88945] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#031B16] transition hover:opacity-90"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              Book Appointment
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#D4B57A]/45 bg-[#05241D]/60 px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#F6EBD6] transition hover:bg-[#D4B57A]/10"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Contact Cradle
            </Link>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[12px] leading-5 text-[#F6EBD6]/62">
          <Sparkles className="h-4 w-4 text-[#D4B57A]" aria-hidden="true" />
          Catalog services are shown for browsing. Booking availability still depends on branch,
          visit type, service visibility, and daily operations settings.
        </p>
      </div>
    </section>
  );
}
