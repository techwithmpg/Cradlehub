"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  BOUTIQUE_CATEGORIES,
  BOUTIQUE_PRODUCTS,
  formatPhp,
} from "@/lib/public/boutique-catalog";

export type BoutiqueCartItem = {
  key: string;
  productId: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
  quantity: number;
  optionLabel?: string;
};

type AddItemInput = {
  productId: string;
  name: string;
  subtitle: string;
  price: number;
  image: string;
  quantity?: number;
  optionLabel?: string;
};

type BoutiqueCartContextValue = {
  items: BoutiqueCartItem[];
  wishlistIds: string[];
  totalCount: number;
  subtotal: number;
  isCartOpen: boolean;
  isSearchOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  addItem: (item: AddItemInput) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
};

const CART_STORAGE_KEY = "cradle_boutique_cart_v1";
const WISHLIST_STORAGE_KEY = "cradle_boutique_wishlist_v1";

const DEFAULT_CONTEXT: BoutiqueCartContextValue = {
  items: [],
  wishlistIds: [],
  totalCount: 0,
  subtotal: 0,
  isCartOpen: false,
  isSearchOpen: false,
  openCart: () => {},
  closeCart: () => {},
  openSearch: () => {},
  closeSearch: () => {},
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
  toggleWishlist: () => {},
};

const BoutiqueCartContext = createContext<BoutiqueCartContextValue>(DEFAULT_CONTEXT);

export function useBoutiqueCart() {
  return useContext(BoutiqueCartContext);
}

const DEFAULT_BRANCH_OPTIONS = [
  "SM City Bacolod (3rd Floor, North Wing)",
  "Main Spa · Lacson (3rd Floor, La Luz Building)",
];

export function BoutiqueCartProvider({
  children,
  branchNames,
}: {
  children: React.ReactNode;
  branchNames?: string[];
}) {
  const [items, setItems] = useState<BoutiqueCartItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationBranch, setReservationBranch] = useState(
    branchNames?.[0] || DEFAULT_BRANCH_OPTIONS[0],
  );
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [reservationSubmitted, setReservationSubmitted] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const cartDialogRef = useRef<HTMLDialogElement>(null);
  const searchDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (rawCart) {
          const parsed = JSON.parse(rawCart);
          if (Array.isArray(parsed)) setItems(parsed);
        }
        const rawWishlist = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
        if (rawWishlist) {
          const parsedWish = JSON.parse(rawWishlist);
          if (Array.isArray(parsedWish)) setWishlistIds(parsedWish);
        }
      } catch {
        // Ignore storage parsing errors
      } finally {
        if (!cancelled) setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      // Ignore quota errors
    }
  }, [wishlistIds, hydrated]);

  useEffect(() => {
    const dialog = cartDialogRef.current;
    if (!dialog) return;
    if (isCartOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isCartOpen]);

  useEffect(() => {
    const dialog = searchDialogRef.current;
    if (!dialog) return;
    if (isSearchOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isSearchOpen]);

  const openCart = useCallback(() => {
    setReservationSubmitted(false);
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
    setReservationOpen(false);
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
  }, []);

  const addItem = useCallback((input: AddItemInput) => {
    const qty = Math.max(1, input.quantity ?? 1);
    const key = input.optionLabel
      ? `${input.productId}::${input.optionLabel}`
      : input.productId;
    setItems((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + qty }
            : item,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: input.productId,
          name: input.name,
          subtitle: input.subtitle,
          price: input.price,
          image: input.image,
          quantity: qty,
          optionLabel: input.optionLabel,
        },
      ];
    });
    setReservationSubmitted(false);
    setIsCartOpen(true);
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity } : item)),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlistIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  }, []);

  const totalCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const filteredSearchProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return BOUTIQUE_PRODUCTS.slice(0, 4);
    return BOUTIQUE_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const resolvedBranches =
    branchNames && branchNames.length > 0 ? branchNames : DEFAULT_BRANCH_OPTIONS;

  const value = useMemo<BoutiqueCartContextValue>(
    () => ({
      items,
      wishlistIds,
      totalCount,
      subtotal,
      isCartOpen,
      isSearchOpen,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      toggleWishlist,
    }),
    [
      items,
      wishlistIds,
      totalCount,
      subtotal,
      isCartOpen,
      isSearchOpen,
      openCart,
      closeCart,
      openSearch,
      closeSearch,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      toggleWishlist,
    ],
  );

  return (
    <BoutiqueCartContext.Provider value={value}>
      {children}

      {/* Slide-over Boutique Cart Drawer (native top-layer dialog) */}
      <dialog
        ref={cartDialogRef}
        aria-label="Your Cart"
        onClose={closeCart}
        onClick={(e) => {
          if (e.target === cartDialogRef.current) closeCart();
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md border-l border-[#E2D9C8] bg-[#FCFAF5] p-0 text-[#10261D] shadow-2xl backdrop:bg-[#10261D]/55 backdrop:backdrop-blur-xs open:flex open:flex-col"
      >
        <div className="flex items-center justify-between border-b border-[#E5DEC9] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#163A2B]" aria-hidden="true" />
            <h2 className="font-serif text-lg font-semibold text-[#10261D] [font-family:var(--sp-font-display)]">
              Your Cart ({totalCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart drawer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2D9C8] text-[#4E5A53] transition hover:bg-[#EDE4D3] hover:text-[#10261D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163A2B]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE4D3] text-[#163A2B]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="font-serif text-lg font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
                Your wellness bag is empty
              </p>
              <p className="mt-1.5 max-w-xs text-sm text-[#5B665F]">
                Explore botanical massage oils, calming linen mists, and spa gift
                certificates available at our Bacolod branches.
              </p>
              <Link
                href="/products"
                onClick={closeCart}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#163A2B] px-5 py-2.5 text-sm font-medium text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
              >
                Explore Boutique
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl border border-[#E5DEC9] bg-white p-3 shadow-xs"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#F5EFE3]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#10261D]">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-[#5B665F]">
                      {item.optionLabel || item.subtitle}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#163A2B]">
                      {formatPhp(item.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center rounded-lg border border-[#DDD4C2] bg-[#FAF7F0]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        aria-label={`Decrease ${item.name} quantity`}
                        className="flex h-7 w-7 items-center justify-center text-[#3D4A42] transition hover:text-[#10261D]"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium text-[#10261D]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        className="flex h-7 w-7 items-center justify-center text-[#3D4A42] transition hover:text-[#10261D]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7A847D] transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {reservationOpen && !reservationSubmitted && (
                <div className="mt-4 rounded-xl border border-[#C8A96B]/45 bg-[#F5EFE3] p-4">
                  <p className="text-xs font-semibold tracking-wider text-[#8C6D32] uppercase">
                    In-Spa Pickup & Concierge Request
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#4A554E]">
                    Online payment checkout is not processed on the website yet. Save
                    your pickup preference below and present this summary at our
                    branch front desk, or include these items when booking your
                    visit.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <label className="block">
                      <span className="text-xs font-medium text-[#2A3830]">
                        Preferred Branch
                      </span>
                      <select
                        value={reservationBranch}
                        onChange={(e) => setReservationBranch(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D7CEBC] bg-white px-3 py-2 text-xs text-[#10261D]"
                      >
                        {resolvedBranches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-[#2A3830]">
                        Your Name
                      </span>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Full name for pickup tag"
                        className="mt-1 w-full rounded-lg border border-[#D7CEBC] bg-white px-3 py-2 text-xs text-[#10261D]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-[#2A3830]">
                        Mobile Number
                      </span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="mt-1 w-full rounded-lg border border-[#D7CEBC] bg-white px-3 py-2 text-xs text-[#10261D]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setReservationSubmitted(true)}
                      className="w-full rounded-lg bg-[#163A2B] px-4 py-2.5 text-xs font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                    >
                      Prepare In-Spa Pickup Summary
                    </button>
                  </div>
                </div>
              )}

              {reservationSubmitted && (
                <div className="mt-4 rounded-xl border border-[#163A2B]/25 bg-[#EAF2ED] p-4 text-xs text-[#10261D]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#163A2B]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">
                        In-Spa Pickup Summary Ready
                      </p>
                      <p className="mt-1 text-[#3D4C43]">
                        Show this list at <strong>{reservationBranch}</strong> or
                        mention it when booking your session. Items total{" "}
                        <strong>{formatPhp(subtotal)}</strong> (settled in person at
                        the spa).
                      </p>
                      {guestName && (
                        <p className="mt-1 text-[#4E5E54]">
                          Prepared for: {guestName}
                          {guestPhone ? ` · ${guestPhone}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#E5DEC9] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#4A554E]">Estimated Total</span>
              <span className="text-lg font-bold text-[#10261D]">
                {formatPhp(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#66726A]">
              Fulfilled for in-spa pickup or front-desk coordination in Bacolod.
            </p>
            <div className="mt-3 space-y-2">
              {!reservationOpen ? (
                <button
                  type="button"
                  onClick={() => setReservationOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#163A2B] px-4 py-3 text-sm font-semibold text-[#FAF5E9] transition hover:bg-[#1E4D3A]"
                >
                  Request In-Spa Pickup →
                </button>
              ) : (
                <Link
                  href="/book"
                  onClick={closeCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4B57A] px-4 py-3 text-sm font-semibold text-[#10261D] transition hover:bg-[#E0C38A]"
                >
                  Pair with Spa Booking →
                </Link>
              )}
              <button
                type="button"
                onClick={closeCart}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#DDD4C2] bg-[#FCFAF5] px-4 py-2.5 text-xs font-medium text-[#2A3830] transition hover:bg-[#EDE4D3]"
              >
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Quick Global Search Dialog */}
      <dialog
        ref={searchDialogRef}
        aria-label="Search Cradle Wellness Living"
        onClose={closeSearch}
        onClick={(e) => {
          if (e.target === searchDialogRef.current) closeSearch();
        }}
        className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-[#DDD4C2] bg-[#FCFAF5] p-0 text-[#10261D] shadow-2xl backdrop:bg-[#10261D]/60 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-[#E5DEC9] px-4 py-3">
          <Search className="h-4 w-4 text-[#6B766F]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search boutique oils, linen spray, or jump to services..."
            aria-label="Search boutique or services"
            className="w-full bg-transparent text-sm text-[#10261D] placeholder:text-[#7A847D] focus:outline-none"
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#5B665F] hover:bg-[#EDE4D3]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                searchQuery.trim()
                  ? `/services?q=${encodeURIComponent(searchQuery.trim())}`
                  : "/services"
              }
              onClick={closeSearch}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#163A2B] px-3.5 py-1.5 text-xs font-medium text-[#FAF5E9]"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#D4B57A]" aria-hidden="true" />
              {searchQuery.trim()
                ? `Search "${searchQuery.trim()}" in Services`
                : "Browse All Spa Services"}
            </Link>
            <Link
              href="/branches"
              onClick={closeSearch}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D7CEBC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#10261D]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#B68A3C]" aria-hidden="true" />
              Bacolod Branches
            </Link>
            {BOUTIQUE_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}`}
                onClick={closeSearch}
                className="rounded-full border border-[#E5DEC9] bg-[#F5EFE3] px-3 py-1.5 text-xs font-medium text-[#3B4840] hover:border-[#C8A96B]"
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#7A6B4F] uppercase">
              Boutique Essentials
            </p>
            <div className="space-y-2">
              {filteredSearchProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products?category=${product.category}`}
                  onClick={closeSearch}
                  className="flex items-center gap-3 rounded-xl border border-[#E5DEC9] bg-white p-2.5 transition hover:border-[#C8A96B]"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#F5EFE3]">
                    <Image
                      src={product.image}
                      alt={product.imageAlt}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#10261D]">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-[#5B665F]">
                      {product.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#163A2B]">
                    {product.priceLabel}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </BoutiqueCartContext.Provider>
  );
}
