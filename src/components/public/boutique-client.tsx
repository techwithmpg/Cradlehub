"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Droplets,
  Gift,
  Heart,
  Leaf,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import {
  BOUTIQUE_CATEGORIES,
  BOUTIQUE_COLLECTIONS,
  BOUTIQUE_GIFT_CARD_OPTIONS,
  BOUTIQUE_HERO_IMAGE,
  BOUTIQUE_PRODUCTS,
  type BoutiqueCategoryId,
  type BoutiqueGiftCardOption,
  type BoutiqueProduct,
} from "@/lib/public/boutique-catalog";
import { useBoutiqueCart } from "@/components/public/boutique-cart-context";

const TRUST_HIGHLIGHTS = [
  {
    icon: Leaf,
    title: "Curated for Wellness",
    subtitle: "Spa-grade botanical blends",
  },
  {
    icon: ShieldCheck,
    title: "Authentic & Quality",
    subtitle: "Trusted Bacolod formulations",
  },
  {
    icon: Store,
    title: "In-Spa Concierge",
    subtitle: "Pick up at either Bacolod branch",
  },
  {
    icon: Gift,
    title: "Perfect for Gifting",
    subtitle: "Virtual & physical gift cards",
  },
];

function CategoryIcon({ category }: { category: BoutiqueCategoryId }) {
  if (category === "oils") return <Droplets className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category === "sprays") return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category === "gift-cards") return <Gift className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category === "wellness-kits") return <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function BoutiqueClient({
  initialCategory = "all",
}: {
  initialCategory?: string;
}) {
  const validCategory: BoutiqueCategoryId = BOUTIQUE_CATEGORIES.some(
    (c) => c.id === initialCategory,
  )
    ? (initialCategory as BoutiqueCategoryId)
    : "all";

  const { wishlistIds, totalCount, addItem, openCart, toggleWishlist } =
    useBoutiqueCart();

  const [activeCategory, setActiveCategory] =
    useState<BoutiqueCategoryId>(validCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [selectedGiftOption, setSelectedGiftOption] =
    useState<BoutiqueGiftCardOption>(BOUTIQUE_GIFT_CARD_OPTIONS[0]!);
  const [giftNote, setGiftNote] = useState("");
  const giftDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = giftDialogRef.current;
    if (!dialog) return;
    if (giftModalOpen) {
      if (!dialog.open && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    } else if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }, [giftModalOpen]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return BOUTIQUE_PRODUCTS.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  const getQty = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, val: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, val)) }));

  const handleAddStandardProduct = (product: BoutiqueProduct) => {
    const qty = getQty(product.id);
    addItem({
      productId: product.id,
      name: product.name,
      subtitle: product.subtitle,
      price: product.price,
      image: product.image,
      quantity: qty,
    });
  };

  const handleAddGiftCertificate = () => {
    const giftProduct = BOUTIQUE_PRODUCTS.find((p) => p.isGiftCertificate);
    if (!giftProduct) return;
    addItem({
      productId: giftProduct.id,
      name: "Gift Certificate",
      subtitle: selectedGiftOption.format,
      price: selectedGiftOption.amount,
      image: giftProduct.image,
      quantity: 1,
      optionLabel: giftNote.trim()
        ? `${selectedGiftOption.label} · "${giftNote.trim()}"`
        : selectedGiftOption.label,
    });
    setGiftNote("");
    setGiftModalOpen(false);
  };

  return (
    <div className="w-full bg-[#F7F3EB] text-[#10261D]">
      {/* Mobile Hero Card matching CradleHub_Boutique_Mobile_Concept */}
      <section className="relative overflow-hidden bg-[#10261D] px-4 pt-6 pb-9 text-[#FAF5E9] md:hidden">
        <div className="mx-auto max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-[#C8A96B]/30 bg-[#163A2B] p-5 shadow-lg">
            <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-2xl">
              <Image
                src={BOUTIQUE_HERO_IMAGE}
                alt="Cradle Boutique botanical massage oils and glowing lantern"
                fill
                preload={true}
                fetchPriority="high"
                sizes="(max-width: 768px) 92vw, 50vw"
                className="object-cover"
              />
            </div>
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#D4B57A] uppercase">
              Cradle Boutique
            </p>
            <h1 className="mt-1 font-serif text-3xl font-medium italic text-[#FAF5E9] [font-family:var(--sp-font-display)]">
              Wellness at Home
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-[#CFD9D1]">
              Signature aromatherapy oils, calming mists, and gift experiences
              prepared for pickup at our Bacolod sanctuaries.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="#boutique-catalog"
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[#D4B57A] px-5 text-xs font-semibold text-[#10261D]"
              >
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Shop Collection →</span>
              </a>
              <button
                type="button"
                onClick={() => setGiftModalOpen(true)}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[#D4B57A]/55 bg-[#10261D]/60 px-5 text-xs font-medium text-[#E8D5A3]"
              >
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Gift Certificates</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop Split-Overlay Hero matching CradleHub_Boutique_Desktop_Concept */}
      <section className="relative hidden overflow-hidden border-b border-[#E5DEC9] bg-[#EFE9DA] md:block">
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
          <div className="relative z-10 max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8A6D3B] uppercase">
              Cradle Boutique
            </p>
            <h1 className="mt-2 font-serif text-4xl font-medium italic tracking-tight text-[#10261D] [font-family:var(--sp-font-display)] lg:text-[52px]">
              Wellness at Home
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#3E4C44]">
              Premium care essentials, botanical oils, linen mists, and gift
              certificates from Cradle Wellness Living in Bacolod.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#boutique-catalog"
                className="inline-flex items-center gap-2 rounded-full bg-[#163A2B] px-6 py-3 text-xs font-semibold text-[#FAF5E9] shadow-xs transition hover:bg-[#1E4D3A]"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
                <span>Shop Collection</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => setGiftModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#163A2B]/30 bg-white px-6 py-3 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
              >
                <Gift className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
                <span>Gift Certificates</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 w-[60%]">
          <Image
            src={BOUTIQUE_HERO_IMAGE}
            alt="Amber apothecary bottles, glowing candle, and spa towel on wood"
            fill
            preload={true}
            fetchPriority="high"
            sizes="60vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#EFE9DA] via-[#EFE9DA]/65 to-transparent"
          />
        </div>
      </section>

      {/* 4-Column Trust Highlights Bar */}
      <section className="border-b border-[#E5DEC9] bg-[#FCFAF5]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 sm:px-6 md:grid-cols-4 lg:px-8">
          {TRUST_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5DEC9] bg-[#F5EFE3] text-[#B68A3C]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#10261D]">
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-[#5B6860]">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Catalog Band */}
      <section
        id="boutique-catalog"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12"
      >
        {/* Filter Chips + Search Bar + Cart Trigger */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label="Boutique categories"
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            {BOUTIQUE_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-[#163A2B] bg-[#163A2B] text-[#FAF5E9]"
                      : "border-[#DDD4C2] bg-white text-[#2A3830] hover:border-[#C8A96B]"
                  }`}
                >
                  <CategoryIcon category={cat.id} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 md:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#7A847D]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                aria-label="Search boutique products"
                className="w-full rounded-full border border-[#DDD4C2] bg-white py-2 pr-8 pl-8 text-xs text-[#10261D] placeholder:text-[#7A847D]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear boutique search"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#7A847D]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openCart}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#163A2B]/30 bg-white px-4 py-2 text-xs font-semibold text-[#163A2B] transition hover:border-[#163A2B]"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
              <span>Cart ({totalCount})</span>
            </button>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)] sm:text-3xl">
              Featured Products
            </h2>
            <p className="mt-1 text-xs text-[#5B6860]">
              Prepared fresh for in-spa pickup or front-desk coordination at our
              Bacolod branches.
            </p>
          </div>
          {activeCategory !== "all" && (
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className="text-xs font-semibold text-[#163A2B] hover:underline"
            >
              View All Products →
            </button>
          )}
        </div>

        {/* Product Grid (2 cols mobile, 4 cols desktop matching mockup) */}
        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[#E5DEC9] bg-white p-10 text-center">
            <p className="font-serif text-lg font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              No boutique items matched your search
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory("all");
                setSearchQuery("");
              }}
              className="mt-4 rounded-full bg-[#163A2B] px-5 py-2 text-xs font-semibold text-[#FAF5E9]"
            >
              Show All Boutique Items
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
            {filteredProducts.map((product) => {
              const liked = wishlistIds.includes(product.id);
              const qty = getQty(product.id);
              return (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs transition hover:border-[#C8A96B] hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full bg-[#F5EFE3]">
                    <Image
                      src={product.image}
                      alt={product.imageAlt}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 22vw, 45vw"
                      className="object-cover"
                    />
                    {product.badge && (
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-[#D4B57A] px-2.5 py-0.5 text-[10px] font-bold text-[#10261D] shadow-xs">
                        {product.badge}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={
                        liked
                          ? `Remove ${product.name} from favorites`
                          : `Save ${product.name} to favorites`
                      }
                      className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#10261D] shadow-xs backdrop-blur-xs transition hover:bg-white"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          liked ? "fill-[#B68A3C] text-[#B68A3C]" : "text-[#4E5A53]"
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    <h3 className="font-serif text-base font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
                      {product.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#5B6860]">
                      {product.subtitle}
                    </p>
                    <p className="mt-2 hidden line-clamp-2 text-xs leading-relaxed text-[#4C5A52] sm:block">
                      {product.description}
                    </p>

                    <div className="mt-auto pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-[#10261D]">
                          {product.priceLabel}
                        </p>
                        <span className="hidden text-[10px] text-[#7A847D] sm:inline">
                          {product.sizeOrVolume}
                        </span>
                      </div>

                      {product.isGiftCertificate ? (
                        <button
                          type="button"
                          onClick={() => setGiftModalOpen(true)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#163A2B]/30 bg-[#FCFAF5] px-3 py-2 text-xs font-semibold text-[#10261D] transition hover:border-[#163A2B] hover:bg-[#EDE4D3]"
                        >
                          <span>Select Options</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex items-center justify-between rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] px-1.5 py-1">
                            <button
                              type="button"
                              onClick={() => setQty(product.id, qty - 1)}
                              aria-label={`Decrease ${product.name} quantity`}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#3E4C44] hover:bg-[#EDE4D3]"
                            >
                              <Minus className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <span className="w-6 text-center text-xs font-semibold text-[#10261D]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQty(product.id, qty + 1)}
                              aria-label={`Increase ${product.name} quantity`}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#3E4C44] hover:bg-[#EDE4D3]"
                            >
                              <Plus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddStandardProduct(product)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#163A2B] px-3 py-2 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Add to Cart</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Wellness Collections Bottom Band */}
        <div className="mt-12 rounded-3xl border border-[#E2D9C8] bg-[#F2ECE0] p-5 sm:p-8">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <h2 className="font-serif text-2xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                Wellness Collections
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#526058]">
                Thoughtfully curated botanicals and gift certificates for daily
                relaxation and thoughtful gifting.
              </p>
              <Link
                href="/book"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#163A2B] hover:underline"
              >
                <span>Pair with a Spa Visit →</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 lg:col-span-9">
              {BOUTIQUE_COLLECTIONS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(col.category);
                    document
                      .getElementById("boutique-catalog")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group flex items-center gap-3.5 overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white p-3 text-left shadow-xs transition hover:border-[#C8A96B]"
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EDE4D3]">
                    <Image
                      src={col.image}
                      alt={col.imageAlt}
                      fill
                      loading="lazy"
                      sizes="120px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#10261D]">
                      {col.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-[#5B6860]">
                      {col.subtitle}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-[#8A6D3B] transition group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Honest Gift Certificate Options Dialog */}
      <dialog
        ref={giftDialogRef}
        aria-label="Select Gift Certificate Options"
        onClose={() => setGiftModalOpen(false)}
        onClick={(e) => {
          if (e.target === giftDialogRef.current) setGiftModalOpen(false);
        }}
        className="m-auto w-[min(94vw,30rem)] rounded-3xl border border-[#DDD4C2] bg-[#FCFAF5] p-0 text-[#10261D] shadow-2xl backdrop:bg-[#10261D]/60 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center justify-between border-b border-[#E5DEC9] px-5 py-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
            <h2 className="font-serif text-lg font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Gift Certificate Options
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setGiftModalOpen(false)}
            aria-label="Close gift options"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#5B6860] hover:bg-[#EDE4D3]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-[#4C5A52]">
            Choose a denomination and format to include in your in-spa concierge
            request. Our Bacolod front desk coordinates voucher preparation and
            payment directly.
          </p>

          <div className="space-y-2">
            {BOUTIQUE_GIFT_CARD_OPTIONS.map((opt) => {
              const selected = selectedGiftOption.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedGiftOption(opt)}
                  aria-pressed={selected}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs transition ${
                    selected
                      ? "border-[#163A2B] bg-[#F5EFE3] font-semibold text-[#10261D]"
                      : "border-[#DDD4C2] bg-white text-[#3E4C44] hover:border-[#C8A96B]"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[11px] text-[#7D5E29]">
                    {opt.format}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[#10261D]">
              Recipient Name (Optional)
            </span>
            <input
              type="text"
              value={giftNote}
              onChange={(e) => setGiftNote(e.target.value)}
              placeholder="e.g., For Maria — Birthday Spa Gift"
              className="mt-1.5 w-full rounded-xl border border-[#DDD4C2] bg-white px-3.5 py-2.5 text-xs text-[#10261D]"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGiftModalOpen(false)}
              className="rounded-full border border-[#DDD4C2] px-4 py-2 text-xs font-semibold text-[#3E4C44]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddGiftCertificate}
              className="rounded-full bg-[#163A2B] px-5 py-2 text-xs font-semibold text-[#FAF5E9] hover:bg-[#1E4D3A]"
            >
              Add Gift Certificate to Cart
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
