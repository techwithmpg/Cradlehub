import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import {
  getPublicHomeCategoryImage,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileCalmCategoriesProps = {
  services: PublicCatalogService[];
  categoryImages?: Record<string, string>;
};

const QUICK_CATEGORIES: {
  key: string;
  label: string;
  categoryName: PublicCatalogCategoryName;
  href: string;
  fallback: string;
}[] = [
  {
    key: "massage",
    label: "Massage",
    categoryName: "Massage Services",
    href: "/services?category=Massage%20Services",
    fallback: SPA_IMAGES.hotStone,
  },
  {
    key: "facials",
    label: "Facials",
    categoryName: "Skin Care Services",
    href: "/services?category=Skin%20Care%20Services",
    fallback: SPA_IMAGES.facialCare,
  },
  {
    key: "body",
    label: "Packages",
    categoryName: "Divine Renewal Packages",
    href: "/services?category=Divine%20Renewal%20Packages",
    fallback: SPA_IMAGES.aromatherapy,
  },
  {
    key: "nails",
    label: "Salon & Nail",
    categoryName: "Salon Services",
    href: "/services?category=Salon%20Services",
    fallback: SPA_IMAGES.nailCare,
  },
];

export function MobileCalmCategories({
  categoryImages = {},
}: MobileCalmCategoriesProps) {
  return (
    <section className="bg-[#F7F3EB] px-4 pt-3 pb-7 text-[#10261D]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-[21px] font-medium leading-tight text-[#10261D] [font-family:var(--sp-font-display)]">
            Our Signature Treatments
          </h2>
          <Link
            href="/services"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#163A2B]"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2.5">
          {QUICK_CATEGORIES.map((cat) => {
            const img =
              categoryImages[cat.categoryName] ||
              getPublicHomeCategoryImage(cat.categoryName) ||
              cat.fallback;
            return (
              <Link
                key={cat.key}
                href={cat.href}
                className="group flex flex-col items-center text-center"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#C8A96B]/65 bg-[#EDE4D3] shadow-xs transition group-hover:border-[#163A2B]">
                  <Image
                    src={img}
                    alt={cat.label}
                    fill
                    sizes="64px"
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
                <span className="mt-1.5 text-[11px] font-medium leading-tight text-[#24342B]">
                  {cat.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
