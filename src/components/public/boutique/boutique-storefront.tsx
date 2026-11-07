"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, Gift, Leaf, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X,
} from "lucide-react";
import {
  BOUTIQUE_PREVIEW_CATEGORIES,
  filterBoutiquePreviewProducts,
  formatBoutiquePreviewPeso,
  type BoutiqueCategory,
  type BoutiquePreviewProduct,
  type BoutiqueSort,
} from "@/lib/boutique/catalogue-preview";
import {
  addBoutiquePreviewItem,
  getBoutiquePreviewCartSummary,
  setBoutiquePreviewQuantity,
  type BoutiquePreviewCartLine,
} from "@/lib/boutique/cart-preview";

function ProductArtwork({ product, compact = false }: {
  product: BoutiquePreviewProduct;
  compact?: boolean;
}) {
  const tones: Record<BoutiquePreviewProduct["palette"], string> = {
    ginger: "from-[#E8D9C2] via-[#F6EEE0] to-[#CEB690]",
    borneol: "from-[#C8D8CB] via-[#E8EFE5] to-[#A5BDA6]",
    linen: "from-[#D8D8CA] via-[#F5F3EB] to-[#C7CCC2]",
  };
  return (
    <div
      role="img"
      aria-label="Illustrative packaging artwork, not a verified product photograph"
      className={[
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        tones[product.palette],
        compact ? "h-16 w-16 rounded-xl" : "aspect-[4/4.6] w-full rounded-2xl",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full border border-white/35" />
      <div className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full border border-white/30" />
      <svg
        aria-hidden="true"
        viewBox="0 0 190 228"
        className={compact ? "h-14 w-12 drop-shadow-md" : "h-[70%] w-[60%] max-w-52 drop-shadow-xl"}
        fill="none"
      >
        <ellipse cx="95" cy="208" rx="56" ry="9" fill="#243629" opacity=".13" />
        {product.artwork === "oil" ? (
          <>
            <rect x="83" y="18" width="24" height="42" rx="5" fill="#243C2E" />
            <rect x="89" y="8" width="12" height="24" rx="4" fill="#23372C" />
            <rect x="53" y="54" width="84" height="144" rx="18" fill="#82522F" />
            <rect x="58" y="57" width="74" height="137" rx="16" fill="#AE7A42" />
            <rect x="66" y="104" width="58" height="66" rx="3" fill="#F5EDE0" />
            <path d="M95 118C80 131 89 147 95 150C101 144 109 130 95 118Z" fill="#44664F" />
            <path d="M95 122V150" stroke="#44664F" strokeWidth="2" />
            <path d="M75 112H115M75 158H115" stroke="#C4A56D" strokeWidth="1" />
            <path d="M63 72C67 68 68 68 68 68V96" stroke="#FFFFFF" strokeWidth="6" opacity=".15" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="74" y="26" width="43" height="26" rx="5" fill="#233A30" />
            <path d="M100 26V14H142V23H114L108 30" fill="#233A30" />
            <rect x="52" y="51" width="87" height="147" rx="16" fill="#E8E2D5" />
            <rect x="56" y="58" width="79" height="136" rx="12" fill="#F9F8F1" />
            <rect x="62" y="104" width="67" height="66" rx="4" fill="#DBE1D5" />
            <path d="M94 118C86 130 88 142 95 149C103 142 102 130 94 118Z" fill="#557A65" />
            <path d="M94 123V153" stroke="#557A65" strokeWidth="2" />
            <path d="M68 112H123M68 158H123" stroke="#C8A96B" />
            <path d="M63 74V96" stroke="white" strokeWidth="5" opacity=".65" strokeLinecap="round" />
          </>
        )}
      </svg>
      {!compact && (
        <span className="absolute bottom-3 left-3 rounded-full border border-[#163A2B]/10 bg-white/75 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#335140]">
          Preview artwork
        </span>
      )}
    </div>
  );
}

export function BoutiqueStorefront({ products }: { products: readonly BoutiquePreviewProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BoutiqueCategory>("All");
  const [sort, setSort] = useState<BoutiqueSort>("featured");
  const [lines, setLines] = useState<BoutiquePreviewCartLine[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [details, setDetails] = useState<BoutiquePreviewProduct | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const closeBagRef = useRef<HTMLButtonElement>(null);
  const closeDetailsRef = useRef<HTMLButtonElement>(null);

  const visible = useMemo(
    () => filterBoutiquePreviewProducts(products, query, category, sort),
    [products, query, category, sort],
  );
  const summary = useMemo(() => getBoutiquePreviewCartSummary(lines, products), [lines, products]);

  useEffect(() => {
    if (!bagOpen && !details) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBagOpen(false);
        setDetails(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bagOpen, details]);

  useEffect(() => {
    if (bagOpen) closeBagRef.current?.focus();
    else if (details) closeDetailsRef.current?.focus();
  }, [bagOpen, details]);

  const add = (product: BoutiquePreviewProduct) => {
    setLines((previous) => addBoutiquePreviewItem(previous, product.id, products));
    setAnnouncement(product.name + " added to preview bag");
  };

  const cartRows = lines.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });

  return (
    <div className="bg-[#FCFAF5] text-[#163A2B]" data-testid="boutique-b1-preview">
      <div className="bg-[#C8A96B] px-4 pt-[calc(env(safe-area-inset-top,0px)+86px)] pb-2 text-center text-[10px] font-semibold uppercase tracking-[.12em] text-[#163A2B] md:pt-28">
        Interactive B1 preview · No orders or payments are accepted
      </div>

      <section className="relative overflow-hidden bg-[#F4EFE5] px-5 pb-12 pt-12 sm:px-8 md:pb-20 md:pt-20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border border-[#C8A96B]/25" />
        <div className="pointer-events-none absolute -bottom-36 right-10 h-80 w-80 rounded-full border border-[#C8A96B]/20" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.28em] text-[#A27C41]">
              <Leaf className="h-4 w-4" /> The Cradle Edit
            </div>
            <h1 className="max-w-xl text-5xl leading-[1.05] sm:text-6xl md:text-7xl" style={{ fontFamily: "var(--sp-font-display), Georgia, serif" }}>
              Little rituals.<br /><span className="italic text-[#AC8D5D]">Lasting calm.</span>
            </h1>
            <p className="max-w-lg text-sm leading-7 text-[#5E7165] sm:text-base">
              Thoughtful wellness essentials for peaceful moments beyond the spa.
              Discover the collection and explore how your boutique experience will feel.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#boutique-collection" className="inline-flex min-h-11 items-center gap-3 rounded-full bg-[#163A2B] px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-[#245340]">
                Explore collection <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/book" className="inline-flex min-h-11 items-center rounded-full border border-[#163A2B]/25 px-6 py-3 text-xs font-semibold uppercase tracking-widest hover:border-[#163A2B]">
                Book a treatment
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {products.map((product, index) => (
              <div key={product.id} className={index === 1 ? "translate-y-6" : ""}>
                <ProductArtwork product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="boutique-collection" className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 lg:pt-20">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.24em] text-[#B08C50]">Curated with care</p>
            <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: "var(--sp-font-display), Georgia, serif" }}>The Wellness Collection</h2>
          </div>
          <p className="max-w-md text-xs leading-6 text-[#77877B]">Product names and prices are owner-supplied. Imagery and descriptions are illustrative. Stock and purchase availability are not connected.</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 border-y border-[#163A2B]/10 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 items-center gap-2 rounded-full border border-[#163A2B]/15 bg-white px-4 sm:w-80">
            <Search className="h-4 w-4 text-[#678070]" />
            <span className="sr-only">Search wellness collection</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search wellness essentials"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#98A79B]"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[#4A6555]">
            <SlidersHorizontal className="h-4 w-4" />
            Sort
            <select
              aria-label="Sort boutique products"
              className="rounded-lg border border-[#163A2B]/15 bg-white px-3 py-2 text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value as BoutiqueSort)}
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>

        <div className="mb-7 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter product category">
          {BOUTIQUE_PREVIEW_CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={item === category}
              onClick={() => setCategory(item)}
              className={[
                "min-h-10 shrink-0 rounded-full border px-5 py-2.5 text-xs font-semibold transition-colors",
                item === category
                  ? "border-[#163A2B] bg-[#163A2B] text-white"
                  : "border-[#163A2B]/15 bg-white text-[#45604E] hover:border-[#163A2B]/50",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <article key={product.id} className="group min-w-0">
              <button
                type="button"
                onClick={() => setDetails(product)}
                aria-label={"View " + product.name + " details"}
                className="block w-full rounded-2xl text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#163A2B]"
              >
                <ProductArtwork product={product} />
              </button>
              <div className="pt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[#A28657]">{product.category}</p>
                <button type="button" className="text-left text-sm font-semibold hover:underline sm:text-base" onClick={() => setDetails(product)}>
                  {product.name}
                </button>
                <p className="mt-1 text-sm text-[#5B735F]">{formatBoutiquePreviewPeso(product.pricePhp)}</p>
                <button
                  type="button"
                  onClick={() => add(product)}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-[#163A2B] px-3 text-[11px] font-semibold uppercase tracking-[.1em] transition-colors hover:bg-[#163A2B] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to preview bag
                </button>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#163A2B]/20 p-12 text-center text-sm text-[#5D7262]">
            No examples match that search. Try another category or keyword.
          </div>
        )}
      </section>

      <section className="bg-[#193B2D] px-5 py-14 text-[#F9F3E8]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#D7B678]"><Gift className="h-4 w-4" /> Give a moment of calm</p>
            <h2 className="mb-3 text-3xl sm:text-4xl" style={{ fontFamily: "var(--sp-font-display), Georgia, serif" }}>Wellness is a beautiful gift.</h2>
            <p className="text-sm leading-6 text-[#E0E7DF]/80">Gift certificates are part of the approved future Boutique journey. They cannot be purchased or issued in this preview.</p>
          </div>
          <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D7B678]/60 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-[#F3E7D0] hover:bg-white/10">
            Enquire at front desk <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <button
        type="button"
        onClick={() => setBagOpen(true)}
        aria-label={"Open preview shopping bag, " + summary.count + " items"}
        className="fixed bottom-8 right-5 z-30 hidden min-h-14 items-center gap-3 rounded-full bg-[#163A2B] px-5 text-sm font-semibold text-white shadow-xl shadow-[#163A2B]/25 hover:bg-[#285840] md:inline-flex"
      >
        <ShoppingBag className="h-5 w-5" /> Bag
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C8A96B] px-1 text-xs text-[#163A2B]" key={summary.count}>{summary.count}</span>
      </button>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#163A2B]/10 bg-[#FCFAF5] px-4 pt-3 shadow-[0_-4px_30px_rgba(25,59,45,0.08)] md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        <button
          type="button"
          onClick={() => setBagOpen(true)}
          className="flex min-h-12 w-full items-center justify-between rounded-full bg-[#163A2B] px-5 text-sm font-semibold text-white"
        >
          <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> View Cart <span className="rounded-full bg-[#D4B57A] px-2 py-0.5 text-[11px] text-[#163A2B]">{summary.count}</span></span>
          <span>{formatBoutiquePreviewPeso(summary.subtotalPhp)} <ArrowRight className="ml-1 inline h-4 w-4" /></span>
        </button>
      </div>
      <div className="h-20 md:hidden" aria-hidden="true" />

      {bagOpen && (
        <div className="fixed inset-0 z-[70] bg-[#0F241B]/55" onMouseDown={(event) => { if (event.target === event.currentTarget) setBagOpen(false); }}>
          <aside role="dialog" aria-modal="true" aria-label="Preview shopping bag" className="absolute inset-0 flex flex-col overflow-y-auto bg-[#FCFAF5] shadow-2xl sm:left-auto sm:w-[430px]">
            <div className="flex items-center justify-between border-b border-[#163A2B]/10 p-5">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[#A28657]">B1 demonstration only</p>
                <h2 className="text-2xl" style={{ fontFamily: "var(--sp-font-display), Georgia, serif" }}>Your Preview Bag</h2>
              </div>
              <button type="button" ref={closeBagRef} aria-label="Close shopping bag" className="rounded-full border border-[#163A2B]/15 p-2" onClick={() => setBagOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-5 p-5">
              {cartRows.length === 0 ? (
                <div className="py-16 text-center text-[#5D7465]">
                  <ShoppingBag className="mx-auto mb-4 h-8 w-8" />
                  <p className="font-semibold">Your bag is empty.</p>
                  <p className="mt-1 text-sm">Explore the collection and add a preview product.</p>
                  <button type="button" className="mt-5 underline" onClick={() => setBagOpen(false)}>Continue browsing</button>
                </div>
              ) : cartRows.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3 border-b border-[#163A2B]/10 pb-4">
                  <ProductArtwork product={product} compact />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="mt-1 text-xs text-[#688070]">{formatBoutiquePreviewPeso(product.pricePhp)}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <button type="button" className="rounded-full border border-[#163A2B]/20 p-1" aria-label={"Decrease " + product.name} onClick={() => setLines((current) => setBoutiquePreviewQuantity(current, product.id, quantity - 1))}><Minus className="h-4 w-4" /></button>
                      <span className="min-w-4 text-center text-xs font-semibold">{quantity}</span>
                      <button type="button" className="rounded-full border border-[#163A2B]/20 p-1" aria-label={"Increase " + product.name} onClick={() => setLines((current) => setBoutiquePreviewQuantity(current, product.id, quantity + 1))}><Plus className="h-4 w-4" /></button>
                      <button type="button" className="ml-auto text-xs underline text-[#6B806F]" onClick={() => setLines((current) => setBoutiquePreviewQuantity(current, product.id, 0))}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#163A2B]/10 p-5">
              <div className="flex items-center justify-between text-sm font-semibold"><span>Preview subtotal</span><span>{formatBoutiquePreviewPeso(summary.subtotalPhp)}</span></div>
              <p className="mt-3 rounded-xl bg-[#F1E7D3] p-3 text-xs leading-5 text-[#725E41]">Preview only: quantities are not reserved, and the bag disappears when you leave this page. No sale or payment can be submitted.</p>
              <button type="button" disabled className="mt-4 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-[#A9B5AD] px-5 text-sm font-semibold text-white" aria-label="Checkout unavailable in B1 preview">
                Checkout not available <Check className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0F241B]/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <section role="dialog" aria-modal="true" aria-label={details.name + " preview details"} className="relative grid w-full max-w-2xl gap-5 overflow-y-auto rounded-2xl bg-[#FCFAF5] p-5 shadow-2xl sm:grid-cols-2 sm:p-7">
            <button type="button" ref={closeDetailsRef} onClick={() => setDetails(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white/85 p-2" aria-label="Close product details"><X className="h-5 w-5" /></button>
            <ProductArtwork product={details} />
            <div className="flex flex-col justify-center gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[.17em] text-[#A28657]">{details.category}</p>
              <h2 className="text-3xl" style={{ fontFamily: "var(--sp-font-display), Georgia, serif" }}>{details.name}</h2>
              <p className="text-lg font-semibold">{formatBoutiquePreviewPeso(details.pricePhp)}</p>
              <p className="text-sm leading-6 text-[#587363]">{details.description}</p>
              <p className="text-xs text-[#A28657]">Illustrative art, not verified product photography.</p>
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#163A2B] text-xs font-semibold text-white" onClick={() => { add(details); setDetails(null); }}>
                <Plus className="h-4 w-4" /> Add to preview bag
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
