import React from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import { BOUTIQUE_PRODUCTS } from "@/lib/public/boutique-catalog";

type MobileSignatureRitualsProps = {
  services?: PublicCatalogService[];
  siteImages?: Record<string, string>;
};

export function MobileSignatureRituals({
  services = [],
}: MobileSignatureRitualsProps) {
  const highlights = BOUTIQUE_PRODUCTS.slice(0, 2);

  return (
    <section className="px-4 py-7 text-[#FAF5E9]">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#E5C98B] uppercase">
              Cradle Boutique
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
              Wellness at Home
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#E8D5A3]"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
            <span>Shop All</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {highlights.map((item) => (
            <Link
              key={item.id}
              href={`/products?category=${item.category}`}
              className="eg-glass-card overflow-hidden rounded-2xl p-2.5"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#0A251B]">
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-[#FAF5E9]">
                {item.name}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#E8D5A3] tabular-nums">{item.priceLabel}</span>
                <ArrowRight className="h-3 w-3 text-[#E5C98B]" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>

        {services.length > 4 && (
          <div className="eg-glass-card rounded-2xl p-4">
            <p className="text-xs text-[#CBD6CD]">
              Looking for facials, salon treatments, or multi-hour packages?
            </p>
            <Link
              href="/services"
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8D5A3]"
            >
              <span>Explore Full Menu ({services.length} services)</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
