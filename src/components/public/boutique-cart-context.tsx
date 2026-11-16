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
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md border-l border-[#D4B57A]/30 bg-[#082117]/95 p-0 text-[#FAF5E9] shadow-2xl backdrop-blur-lg backdrop:bg-[#03100B]/70 backdrop:backdrop-blur-xs open:flex open:flex-col"
      >
        <div className="flex items-center justify-between border-b border-[#D4B57A]/20 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#E5C98B]" aria-hidden="true" />
            <h2 className="font-serif text-lg font-semibold text-[#FAF5E9] [font-family:var(--sp-font-display)]">
              Your Cart ({totalCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart drawer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D4B57A]/30 text-[#CBD6CD] transition hover:bg-[#14402E] hover:text-[#FAF5E9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8D5A3]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="font-serif text-lg font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                Your wellness bag is empty
              </p>
              <p className="mt-1.5 max-w-xs text-sm text-[#CBD6CD]">
                Explore botanical massage oils, calming linen mists, and spa gift
                certificates available at our Bacolod branches.
              </p>
              <Link
                href="/products"
                onClick={closeCart}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D4B57A] px-5 py-2.5 text-sm font-semibold text-[#071A12] transition hover:brightness-105"
              >
                Explore Boutique
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="eg-glass-card flex items-center gap-3 rounded-xl p-3"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#0A251B]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#FAF5E9]">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-[#CBD6CD]">
                      {item.optionLabel || item.subtitle}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#E8D5A3] tabular-nums">
                      {formatPhp(item.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center rounded-lg border border-[#D4B57A]/25 bg-[#071E15]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        aria-label={`Decrease ${item.name} quantity`}
                        className="flex h-7 w-7 items-center justify-center text-[#CBD6CD] transition hover:text-[#FAF5E9]"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium text-[#FAF5E9]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        className="flex h-7 w-7 items-center justify-center text-[#CBD6CD] transition hover:text-[#FAF5E9]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#CBD6CD] transition hover:bg-red-950/50 hover:text-rose-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {reservationOpen && !reservationSubmitted && (
                <div className="eg-glass-card mt-4 rounded-xl p-4">
                  <p className="text-xs font-semibold tracking-wider text-[#E5C98B] uppercase">
                    In-Spa Pickup &amp; Concierge Request
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#CBD6CD]">
                    Online payment checkout is not processed on the website yet. Save
                    your pickup preference below and present this summary at our
                    branch front desk, or include these items when booking your
                    visit.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <label className="block">
                      <span className="text-xs font-medium text-[#FAF5E9]">
                        Preferred Branch
                      </span>
                      <select
                        value={reservationBranch}
                        onChange={(e) => setReservationBranch(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D4B57A]/30 bg-[#071E15] px-3 py-2 text-xs text-[#FAF5E9]"
                      >
                        {resolvedBranches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-[#FAF5E9]">
                        Your Name
                      </span>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Full name for pickup tag"
                        className="mt-1 w-full rounded-lg border border-[#D4B57A]/30 bg-[#071E15] px-3 py-2 text-xs text-[#FAF5E9] placeholder:text-[#96A89D]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-[#FAF5E9]">
                        Mobile Number
                      </span>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="mt-1 w-full rounded-lg border border-[#D4B57A]/30 bg-[#071E15] px-3 py-2 text-xs text-[#FAF5E9] placeholder:text-[#96A89D]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setReservationSubmitted(true)}
                      className="w-full rounded-lg bg-[#D4B57A] px-4 py-2.5 text-xs font-semibold text-[#071A12] transition hover:brightness-105"
                    >
                      Prepare In-Spa Pickup Summary
                    </button>
                  </div>
                </div>
              )}

              {reservationSubmitted && (
                <div className="mt-4 rounded-xl border border-[#D4B57A]/35 bg-[#0F3827] p-4 text-xs text-[#FAF5E9]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#E5C98B]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">
                        In-Spa Pickup Summary Ready
                      </p>
                      <p className="mt-1 text-[#CBD6CD]">
                        Show this list at <strong>{reservationBranch}</strong> or
                        mention it when booking your session. Items total{" "}
                        <strong>{formatPhp(subtotal)}</strong> (settled in person at
                        the spa).
                      </p>
                      {guestName && (
                        <p className="mt-1 text-[#E8D5A3]">
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
          <div className="border-t border-[#D4B57A]/20 bg-[#061810] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#CBD6CD]">Estimated Total</span>
              <span className="text-lg font-bold text-[#E8D5A3] tabular-nums">
                {formatPhp(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#9CB0A3]">
              Fulfilled for in-spa pickup or front-desk coordination in Bacolod.
            </p>
            <div className="mt-3 space-y-2">
              {!reservationOpen ? (
                <button
                  type="button"
                  onClick={() => setReservationOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-4 py-3 text-sm font-semibold text-[#071A12] transition hover:brightness-105"
                >
                  Request In-Spa Pickup →
                </button>
              ) : (
                <Link
                  href="/book"
                  onClick={closeCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4B57A] px-4 py-3 text-sm font-semibold text-[#071A12] transition hover:brightness-105"
                >
                  Pair with Spa Booking →
                </Link>
              )}
              <button
                type="button"
                onClick={closeCart}
                className="eg-glass-pill flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium text-[#FAF5E9]"
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
        className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-[#D4B57A]/35 bg-[#082218]/95 p-0 text-[#FAF5E9] shadow-2xl backdrop-blur-lg backdrop:bg-[#03100B]/70 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-[#D4B57A]/20 px-4 py-3">
          <Search className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search boutique oils, linen spray, or jump to services..."
            aria-label="Search boutique or services"
            className="w-full bg-transparent text-sm text-[#FAF5E9] placeholder:text-[#96A89D] focus:outline-none"
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#CBD6CD] hover:bg-[#14402E]"
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
              className="inline-flex items-center gap-1.5 rounded-full bg-[#D4B57A] px-3.5 py-1.5 text-xs font-semibold text-[#071A12]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {searchQuery.trim()
                ? `Search "${searchQuery.trim()}" in Services`
                : "Browse All Spa Services"}
            </Link>
            <Link
              href="/branches"
              onClick={closeSearch}
              className="eg-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-[#FAF5E9]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
              Bacolod Branches
            </Link>
            {BOUTIQUE_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}`}
                onClick={closeSearch}
                className="eg-glass-pill rounded-full px-3 py-1.5 text-xs font-medium text-[#CBD6CD] hover:border-[#E8D5A3]"
              >
                {cat.label}
              </Link>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#E5C98B] uppercase">
              Boutique Essentials
            </p>
            <div className="space-y-2">
              {filteredSearchProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products?category=${product.category}`}
                  onClick={closeSearch}
                  className="eg-glass-card flex items-center gap-3 rounded-xl p-2.5"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#0A251B]">
                    <Image
                      src={product.image}
                      alt={product.imageAlt}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#FAF5E9]">
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-[#CBD6CD]">
                      {product.subtitle}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#E8D5A3] tabular-nums">
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
