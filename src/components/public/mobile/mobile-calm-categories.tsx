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

const CATEGORY_IMAGE_CLASSES: Partial<Record<PublicCatalogCategoryName, string>> = {
  "Massage Services": "object-[center_42%]",
  "Salon Services": "object-[center_45%]",
  "Skin Care Services": "object-[center_45%]",
  "Divine Renewal Packages": "object-center",
  "Spa Party Packages": "object-[center_45%]",
};

const HOME_CATEGORY_IMAGES: Partial<Record<PublicCatalogCategoryName, string>> = {
  "Divine Renewal Packages": "/images/spa/home/packages.jpg",
  "Spa Party Packages": "/images/spa/home/spa-party.jpg",
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
              className="group relative block min-h-[238px] overflow-hidden rounded-[30px] border border-[#C8A96A]/22 bg-[#05241D] shadow-[0_22px_52px_rgba(0,0,0,0.24)]"
            >
              <Image
                src={HOME_CATEGORY_IMAGES[categoryName] ?? detail.image}
                alt={detail.shortName}
                fill
                className={`object-cover ${CATEGORY_IMAGE_CLASSES[categoryName] ?? "object-center"} transition-transform duration-700 group-active:scale-[1.03]`}
                sizes="calc(100vw - 32px)"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,27,22,0.08)_0%,rgba(3,27,22,0.28)_45%,rgba(3,27,22,0.88)_100%),radial-gradient(circle_at_80%_20%,rgba(212,181,122,0.1)_0%,transparent_36%)]" />
              <span className="absolute left-5 top-4 z-10 inline-flex rounded-full border border-[#D4B57A]/34 bg-[#031B16]/42 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A] backdrop-blur-md">
                {detail.eyebrow}
              </span>
              <div className="absolute bottom-6 left-5 right-[5.25rem] z-10">
                <Sparkles
                  className="mb-2 h-4 w-4 text-[#D4B57A]"
                  aria-hidden="true"
                />
                <h3 className="text-[30px] font-medium leading-none text-[#F8EEDC] [font-family:var(--sp-font-accent)]">
                  {detail.shortName}
                </h3>
                <p className="mt-2 max-w-[245px] text-[12px] leading-5 text-[#F6E8D4]/82">
                  {detail.description}
                </p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A]">
                  {count > 0 ? `${count} treatments` : "View menu"}
                </p>
              </div>
              <span className="absolute bottom-6 right-5 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/45 bg-[#031B16]/45 text-[#D4B57A] backdrop-blur-md transition-transform duration-300 group-active:scale-95">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}
