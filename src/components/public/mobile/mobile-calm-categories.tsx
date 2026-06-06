import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
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
          Service Categories
        </p>
        <MobileScrollFloatHeading text="Choose Your Calm" />
      </div>

      <div className="space-y-3.5">
        {categories.map(({ categoryName, detail, count }) => (
          <MobileFadeUp key={categoryName}>
            <Link
              href={`/services#${categoryName.toLowerCase().replace(/\s+/g, "-")}`}
              className="group relative block min-h-[226px] overflow-hidden rounded-[30px] border border-[#C8A96A]/24 bg-[#05241D] shadow-[0_24px_58px_rgba(0,0,0,0.32)]"
            >
              <Image
                src={detail.image}
                alt={detail.shortName}
                fill
                className="object-cover transition-transform duration-700 group-active:scale-[1.03]"
                sizes="calc(100vw - 32px)"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(200,169,106,0.18)_0%,transparent_44%),linear-gradient(to_bottom,rgba(3,27,22,0.24)_0%,rgba(3,27,22,0.18)_42%,rgba(3,27,22,0.9)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <span className="mb-10 inline-flex rounded-full border border-[#C8A96A]/32 bg-[#061912]/52 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A] backdrop-blur-md">
                  {detail.eyebrow}
                </span>
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-[230px]">
                    <Sparkles
                      className="mb-2 h-5 w-5 text-[#C8A96A]"
                      aria-hidden="true"
                    />
                    <h3 className="text-[30px] font-medium leading-none text-[#F5ECDD] [font-family:var(--sp-font-accent)]">
                      {detail.shortName}
                    </h3>
                    <p className="mt-2 text-[12px] leading-5 text-[#EFE3CF]/78">
                      {detail.description}
                    </p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A]">
                      {count > 0 ? `${count} treatments` : "View menu"}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8A96A]/50 bg-[#061912]/48 text-[#D4B57A] backdrop-blur-md transition-transform duration-300 group-active:scale-95">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Link>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
