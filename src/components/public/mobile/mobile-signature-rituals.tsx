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
    <section className="bg-[#F7F3EB] px-4 py-7 text-[#10261D]">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
              Cradle Boutique
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Wellness at Home
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#163A2B]"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
            <span>Shop All</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {highlights.map((item) => (
            <Link
              key={item.id}
              href={`/products?category=${item.category}`}
              className="overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white p-2.5 shadow-xs"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F5EFE3]">
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-[#10261D]">
                {item.name}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#163A2B]">{item.priceLabel}</span>
                <ArrowRight className="h-3 w-3 text-[#8A6D3B]" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>

        {services.length > 4 && (
          <div className="rounded-2xl border border-[#E5DEC9] bg-white p-4">
            <p className="text-xs text-[#526058]">
              Looking for facials, salon treatments, or multi-hour packages?
            </p>
            <Link
              href="/services"
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#163A2B]"
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
