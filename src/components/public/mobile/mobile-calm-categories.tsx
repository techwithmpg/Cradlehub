import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  PUBLIC_CATALOG_CATEGORY_DETAILS,
  PUBLIC_CATALOG_CATEGORY_NAMES,
  type PublicCatalogCategoryName,
} from "@/lib/public/service-catalog-config";
import type { PublicCatalogService } from "@/lib/queries/services";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

type MobileCalmCategoriesProps = {
  services: PublicCatalogService[];
};

export function MobileCalmCategories({ services }: MobileCalmCategoriesProps) {
  const categories = PUBLIC_CATALOG_CATEGORY_NAMES.map((categoryName) => {
    const detail =
      PUBLIC_CATALOG_CATEGORY_DETAILS[categoryName as PublicCatalogCategoryName];
    const count = services.filter(
      (service) => service.categoryName === categoryName
    ).length;

    return { categoryName, detail, count };
  });

  return (
    <section className="px-4 pt-10">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          Service categories
        </p>
        <MobileScrollFloatHeading text="Choose Your Calm" />
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map(({ categoryName, detail, count }) => (
          <MobileFadeUp key={categoryName} className="w-[232px] shrink-0">
            <Link
              href={`/services#${categoryName.toLowerCase().replace(/\s+/g, "-")}`}
              className="group block overflow-hidden rounded-[26px] border border-[#C8A96A]/20 bg-[#F3E9D2] shadow-[0_18px_44px_rgba(0,0,0,0.18)]"
            >
              <div className="relative h-[150px] overflow-hidden">
                <Image
                  src={detail.image}
                  alt={detail.shortName}
                  fill
                  className="object-cover transition-transform duration-700 group-active:scale-[1.03]"
                  sizes="232px"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,17,12,0.78)_0%,rgba(4,17,12,0.18)_58%,rgba(4,17,12,0)_100%)]" />
                <span className="absolute left-4 top-4 rounded-full border border-[#C8A96A]/30 bg-[#061912]/55 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#F3E9D2] backdrop-blur-md">
                  {detail.eyebrow}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[22px] font-medium leading-none text-[#0D2B20] [font-family:var(--sp-font-accent)]">
                      {detail.shortName}
                    </h3>
                    <p className="mt-2 text-[11px] leading-5 text-[#405448]">
                      {detail.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-[#A9792B]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A6A1F]">
                  {count > 0 ? `${count} treatments` : "View menu"}
                </p>
              </div>
            </Link>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
