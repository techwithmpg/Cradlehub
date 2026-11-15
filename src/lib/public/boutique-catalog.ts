import { SPA_IMAGES } from "@/constants/spa-images";

export type BoutiqueCategoryId =
  | "all"
  | "oils"
  | "sprays"
  | "gift-cards"
  | "wellness-kits";

export type BoutiqueGiftCardOption = {
  id: string;
  label: string;
  amount: number;
  format: "Virtual E-Card" | "Physical In-Spa Card";
};

export type BoutiqueProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  category: Exclude<BoutiqueCategoryId, "all">;
  price: number;
  priceLabel: string;
  badge?: string;
  image: string;
  imageAlt: string;
  sizeOrVolume: string;
  isGiftCertificate?: boolean;
  giftOptions?: BoutiqueGiftCardOption[];
  inSpaNote: string;
};

export type BoutiqueCollection = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: Exclude<BoutiqueCategoryId, "all">;
  image: string;
  imageAlt: string;
};

export const BOUTIQUE_CATEGORIES: {
  id: BoutiqueCategoryId;
  label: string;
  shortLabel: string;
}[] = [
  { id: "all", label: "All Products", shortLabel: "All" },
  { id: "oils", label: "Oils", shortLabel: "Oils" },
  { id: "sprays", label: "Sprays", shortLabel: "Sprays" },
  { id: "gift-cards", label: "Gift Cards", shortLabel: "Gift Cards" },
  { id: "wellness-kits", label: "Wellness Kits", shortLabel: "Kits" },
];

export const BOUTIQUE_GIFT_CARD_OPTIONS: BoutiqueGiftCardOption[] = [
  {
    id: "gc-500-virtual",
    label: "₱500 · Virtual E-Card",
    amount: 500,
    format: "Virtual E-Card",
  },
  {
    id: "gc-1000-virtual",
    label: "₱1,000 · Virtual E-Card",
    amount: 1000,
    format: "Virtual E-Card",
  },
  {
    id: "gc-1500-physical",
    label: "₱1,500 · Physical Spa Envelope",
    amount: 1500,
    format: "Physical In-Spa Card",
  },
  {
    id: "gc-2500-physical",
    label: "₱2,500 · Physical Spa Envelope",
    amount: 2500,
    format: "Physical In-Spa Card",
  },
];

export const BOUTIQUE_HERO_IMAGE = "/images/boutique/boutique-hero.webp";

export const BOUTIQUE_PRODUCTS: BoutiqueProduct[] = [
  {
    id: "ginger-oil",
    slug: "ginger-oil",
    name: "Ginger Oil",
    subtitle: "Warming · Relaxing · Muscle Relief",
    description:
      "Slow-infused botanical ginger massage oil formulated to warm stiff joints, ease deep tension, and restore calm circulation after a long day.",
    category: "oils",
    price: 300,
    priceLabel: "₱300",
    badge: "Bestseller",
    image: "/images/boutique/ginger-oil.webp",
    imageAlt: "Cradle Ginger Oil amber apothecary bottle",
    sizeOrVolume: "100 ml Amber Dropper Bottle",
    inSpaNote: "Available for in-spa pickup or front-desk reservation.",
  },
  {
    id: "borneol-oil",
    slug: "borneol-oil",
    name: "Borneol Oil",
    subtitle: "Cooling · Soothing · Refreshing",
    description:
      "Crisp herbal borneol infusion that cools fatigued shoulders, clarifies breathing, and refreshes heavy muscles between treatments.",
    category: "oils",
    price: 300,
    priceLabel: "₱300",
    image: "/images/boutique/borneol-oil.webp",
    imageAlt: "Cradle Borneol Oil amber bottle with mint leaves",
    sizeOrVolume: "100 ml Amber Apothecary Bottle",
    inSpaNote: "Available for in-spa pickup or front-desk reservation.",
  },
  {
    id: "linen-spray",
    slug: "linen-spray",
    name: "Linen Spray",
    subtitle: "Fresh Scent · Relaxing · Long-lasting",
    description:
      "Fine botanical room and pillow mist featuring calming lavender and soft woods to turn your bedroom into a quiet evening sanctuary.",
    category: "sprays",
    price: 250,
    priceLabel: "₱250",
    image: "/images/boutique/linen-spray.webp",
    imageAlt: "Cradle Linen Spray amber mist bottle beside folded towels",
    sizeOrVolume: "100 ml Fine Mist Spray",
    inSpaNote: "Available for in-spa pickup or front-desk reservation.",
  },
  {
    id: "gift-certificate",
    slug: "gift-certificate",
    name: "Gift Certificate",
    subtitle: "(Virtual or Physical)",
    description:
      "Share a restorative Cradle Wellness Living session in Bacolod. Request a preferred value for in-spa envelope pickup or digital issuance coordination with our front desk.",
    category: "gift-cards",
    price: 500,
    priceLabel: "From ₱500",
    image: "/images/boutique/gift-certificate.webp",
    imageAlt: "Cradle Wellness Living forest green and gold ribbon Gift Certificate",
    sizeOrVolume: "Valid at Main Spa & SM Bacolod",
    isGiftCertificate: true,
    giftOptions: BOUTIQUE_GIFT_CARD_OPTIONS,
    inSpaNote: "Issued directly by our Bacolod front-desk concierge.",
  },
  {
    id: "calm-evening-duo",
    slug: "calm-evening-duo",
    name: "Calm Evening Duo",
    subtitle: "Ginger Oil + Linen Spray",
    description:
      "Pair our signature warming massage oil with the lavender linen mist for a complete at-home unwind ritual before sleep.",
    category: "wellness-kits",
    price: 520,
    priceLabel: "₱520",
    badge: "Curated Set",
    image: SPA_IMAGES.aromatherapy,
    imageAlt: "Cradle Calm Evening Duo wellness set",
    sizeOrVolume: "2-Piece Wellness Box",
    inSpaNote: "Gift-wrapped upon request at either Bacolod branch.",
  },
  {
    id: "sanctuary-body-trilogy",
    slug: "sanctuary-body-trilogy",
    name: "Sanctuary Ritual Trio",
    subtitle: "Ginger · Borneol · Linen Mist",
    description:
      "Our complete signature home-care trio combining warming relief, cooling refreshment, and peaceful evening aromatherapy.",
    category: "wellness-kits",
    price: 790,
    priceLabel: "₱790",
    image: SPA_IMAGES.hotStone,
    imageAlt: "Cradle Sanctuary Ritual Trio wellness essentials",
    sizeOrVolume: "Full 3-Bottle Gift Set",
    inSpaNote: "Prepared fresh for branch pickup.",
  },
];

export const BOUTIQUE_COLLECTIONS: BoutiqueCollection[] = [
  {
    id: "relax-unwind",
    title: "Relax & Unwind",
    subtitle: "Calming essentials for rest",
    description: "Gentle mists and soothing oils crafted for unhurried evenings.",
    category: "sprays",
    image: "/images/boutique/linen-spray.webp",
    imageAlt: "Linen spray and warm candlelight for relaxation",
  },
  {
    id: "home-spa-essentials",
    title: "Home Spa Essentials",
    subtitle: "Bring the spa experience home",
    description: "Therapeutic body oils formulated for post-shower and muscle care.",
    category: "oils",
    image: "/images/boutique/boutique-hero.webp",
    imageAlt: "Cradle amber bottles and rolled towel home spa essentials",
  },
  {
    id: "gift-wellness-sets",
    title: "Gift & Wellness Sets",
    subtitle: "Perfect for any occasion",
    description: "Signature gift certificates and bundled rituals wrapped with care.",
    category: "gift-cards",
    image: "/images/boutique/gift-certificate.webp",
    imageAlt: "Cradle Gift Certificate and curated wellness sets",
  },
];

export function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}
