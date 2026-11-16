import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill,
    width,
    height,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    width?: number;
    height?: number;
  }) => {
    if (!fill && (width === undefined || height === undefined)) {
      throw new Error(`next/image requires fill or width/height for src=${String(src)}`);
    }
    return <span data-next-image="" data-src={src} data-alt={alt} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
}));

vi.mock("server-only", () => ({}));

import {
  DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL,
  normalizeSafeImageUrl,
  resolveHybridImage,
} from "@/lib/public/public-image-resolver";
import {
  DEFAULT_SERVICE_IMAGE_URL,
  resolveServiceImage,
} from "@/lib/service-images";
import {
  BOUTIQUE_COLLECTIONS,
  BOUTIQUE_HERO_IMAGE,
  BOUTIQUE_PRODUCTS,
} from "@/lib/public/boutique-catalog";
import {
  BOUTIQUE_COLLECTION_ASSET_SECTION_KEY,
  BOUTIQUE_HERO_SECTION_KEY,
  BOUTIQUE_PRODUCT_ASSET_SECTION_KEY,
  resolveBoutiqueCatalog,
} from "@/lib/public/boutique-data";
import { resolvePublicBranchImage } from "@/lib/public/public-site-data";
import { MobileHomeHeroCarousel } from "@/components/public/mobile/mobile-home-hero-carousel";
import { MobileCalmCategories } from "@/components/public/mobile/mobile-calm-categories";
import { MobileMostLovedTreatments } from "@/components/public/mobile/mobile-most-loved-treatments";
import { MobileSignatureRituals } from "@/components/public/mobile/mobile-signature-rituals";
import { MobileBranchesSection } from "@/components/public/mobile/mobile-branches-section";
import { MobileFinalCta } from "@/components/public/mobile/mobile-final-cta";
import { ServiceImageThumbnail } from "@/components/features/services/service-image-thumbnail";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { PublicCatalogService } from "@/lib/queries/services";

const ANGELS_MASSAGE_ID = "8bce4f5f-4392-457f-adea-1ccacf846dc6";

function makeSectionRow(overrides: Partial<PublicSiteSectionRow>): PublicSiteSectionRow {
  return {
    id: "sec-1",
    section_key: "boutique",
    title: "Wellness at Home",
    subtitle: "Care essentials",
    body: null,
    cta_label: null,
    cta_href: null,
    image_url: null,
    secondary_image_url: null,
    sort_order: 1,
    is_enabled: true,
    metadata: {},
    created_at: "2026-11-16T00:00:00.000Z",
    updated_at: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

function makeAssetRow(overrides: Partial<PublicSiteAssetRow>): PublicSiteAssetRow {
  return {
    id: "asset-1",
    section_key: BOUTIQUE_PRODUCT_ASSET_SECTION_KEY,
    title: "Boutique Image",
    alt_text: "Botanical oil",
    image_url: "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/boutique/test.webp",
    link_href: null,
    sort_order: 1,
    is_enabled: true,
    metadata: {},
    created_at: "2026-11-16T00:00:00.000Z",
    updated_at: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

function makeCatalogService(overrides: Partial<PublicCatalogService> = {}): PublicCatalogService {
  return {
    id: ANGELS_MASSAGE_ID,
    name: "Angels Massage",
    description: "Gentle full-body massage",
    categoryName: "Massage Services",
    categoryOrder: 1,
    subcategory: "Massage",
    durationMinutes: 60,
    durationText: "60 mins",
    price: 750,
    priceLabel: "₱750",
    shortDescription: "Gentle full-body massage",
    packagePax: null,
    packageDurationText: null,
    requiresConsultation: false,
    badges: [],
    inclusions: [],
    imageUrl: DEFAULT_SERVICE_IMAGE_URL,
    imageAlt: "Angels Massage at Cradle Wellness Living",
    availableInSpa: true,
    availableHomeService: false,
    isPublicBookable: true,
    isCsrOnly: false,
    isVip: false,
    isCatalogOnly: false,
    ...overrides,
  };
}

describe("hybrid image resolver & safe URL normalization", () => {
  it("exports immutable 1-year Storage cache-control constant", () => {
    expect(DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL).toBe("31536000");
  });

  it("rejects dangerous, relative-protocol, credentialed, or whitespace-containing URLs", () => {
    expect(normalizeSafeImageUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSafeImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(normalizeSafeImageUrl("//evil.example.com/a.webp")).toBeNull();
    expect(normalizeSafeImageUrl("https://user:pass@example.com/a.webp")).toBeNull();
    expect(normalizeSafeImageUrl("C:\\temp\\a.webp")).toBeNull();
    expect(normalizeSafeImageUrl("/images/services/default-service.webp")).toBe(
      "/images/services/default-service.webp"
    );
    expect(
      normalizeSafeImageUrl(
        "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/service-images/x.webp"
      )
    ).toBe(
      "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/service-images/x.webp"
    );

    // Ensure non-constructor global URL stubs (e.g. jsdom vi.stubGlobal("URL", { ...URL })) still validate safely
    vi.stubGlobal("URL", { createObjectURL: vi.fn() });
    try {
      expect(normalizeSafeImageUrl("https://example.com/service.webp")).toBe(
        "https://example.com/service.webp"
      );
      expect(normalizeSafeImageUrl("https://user:pass@example.com/service.webp")).toBeNull();
      expect(normalizeSafeImageUrl("javascript:alert(1)")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("prioritizes branch override > service catalog DB/Storage URL > manifest by ID > Category A default", () => {
    const withBranchOverride = resolveServiceImage({
      id: ANGELS_MASSAGE_ID,
      name: "Renamed Treatment",
      branchImageUrl:
        "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/branch/custom.webp",
      imageUrl:
        "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/service-images/main.webp",
    });
    expect(withBranchOverride.imageUrl).toContain("/branch/custom.webp");

    const withDbUrl = resolveServiceImage({
      id: ANGELS_MASSAGE_ID,
      name: "Angels Massage",
      imageUrl:
        "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/service-images/main.webp",
    });
    expect(withDbUrl.imageUrl).toContain("/service-images/main.webp");

    const withManifestId = resolveServiceImage({
      id: ANGELS_MASSAGE_ID,
      name: "Totally Renamed Service",
      imageUrl: null,
    });
    expect(withManifestId.imageUrl).toBe("/images/services/001-angels-massage.webp");

    // Unknown ID must NOT collide by name with Angels Massage
    const unknownIdSameName = resolveServiceImage({
      id: "00000000-0000-0000-0000-000000000999",
      name: "Angels Massage",
      imageUrl: null,
    });
    expect(unknownIdSameName.imageUrl).toBe(DEFAULT_SERVICE_IMAGE_URL);
  });

  it("falls back cleanly to DEFAULT_SERVICE_IMAGE_URL when unmigrated manifest file is absent on clean checkout", () => {
    const cleanCheckoutResolved = resolveServiceImage(
      {
        id: ANGELS_MASSAGE_ID,
        name: "Angels Massage",
        imageUrl: null,
      },
      {
        isAvailable: (url) => !url.endsWith("001-angels-massage.webp"),
      }
    );
    expect(cleanCheckoutResolved.imageUrl).toBe(DEFAULT_SERVICE_IMAGE_URL);
  });

  it("resolves generic hybrid candidate chain deterministically", () => {
    const picked = resolveHybridImage(
      [
        { value: "javascript:void(0)", tier: "override" },
        { value: "/images/missing.jpg", tier: "database" },
        { value: "/images/spa/contact.jpg", tier: "manifest_fallback" },
      ],
      "/images/services/default-service.webp",
      (url) => url !== "/images/missing.jpg"
    );
    expect(picked).toEqual({ url: "/images/spa/contact.jpg", tier: "manifest_fallback" });
  });
});

describe("Boutique & branch hybrid resolution", () => {
  it("keeps static Category A Boutique catalog intact when no DB overrides exist", () => {
    const catalog = resolveBoutiqueCatalog({ heroSection: null, assets: [], verifyAssets: false });
    expect(catalog.heroImage).toBe(BOUTIQUE_HERO_IMAGE);
    expect(catalog.products).toHaveLength(BOUTIQUE_PRODUCTS.length);
    expect(catalog.collections).toHaveLength(BOUTIQUE_COLLECTIONS.length);
    expect(catalog.products.map((p) => p.price)).toEqual(BOUTIQUE_PRODUCTS.map((p) => p.price));
  });

  it("applies Boutique Storage hero, product & collection overrides without altering prices or SKUs", () => {
    const heroUrl =
      "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/boutique/hero-v2.webp";
    const gingerUrl =
      "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/boutique/ginger-v2.webp";
    const relaxColUrl =
      "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/boutique/col-relax-v2.webp";

    const catalog = resolveBoutiqueCatalog({
      verifyAssets: false,
      heroSection: makeSectionRow({
        section_key: BOUTIQUE_HERO_SECTION_KEY,
        image_url: heroUrl,
        metadata: { imageAltText: "Warm amber boutique bottles" },
      }),
      assets: [
        makeAssetRow({
          id: "a-ginger",
          section_key: BOUTIQUE_PRODUCT_ASSET_SECTION_KEY,
          image_url: gingerUrl,
          alt_text: "Updated Ginger Oil studio photo",
          metadata: { productId: "ginger-oil" },
        }),
        makeAssetRow({
          id: "a-disabled",
          section_key: BOUTIQUE_PRODUCT_ASSET_SECTION_KEY,
          image_url: "https://example.com/disabled.webp",
          is_enabled: false,
          metadata: { productId: "borneol-oil" },
        }),
        makeAssetRow({
          id: "a-col",
          section_key: BOUTIQUE_COLLECTION_ASSET_SECTION_KEY,
          image_url: relaxColUrl,
          alt_text: "Updated Relax collection photo",
          metadata: { collectionId: "relax-unwind" },
        }),
      ],
    });

    expect(catalog.heroImage).toBe(heroUrl);
    expect(catalog.heroAlt).toBe("Warm amber boutique bottles");
    const ginger = catalog.products.find((p) => p.id === "ginger-oil")!;
    expect(ginger.image).toBe(gingerUrl);
    expect(ginger.imageAlt).toBe("Updated Ginger Oil studio photo");
    expect(ginger.price).toBe(BOUTIQUE_PRODUCTS.find((p) => p.id === "ginger-oil")!.price);

    const borneol = catalog.products.find((p) => p.id === "borneol-oil")!;
    expect(borneol.image).toBe("/images/boutique/borneol-oil.webp");

    const relaxCol = catalog.collections.find((c) => c.id === "relax-unwind")!;
    expect(relaxCol.image).toBe(relaxColUrl);
    expect(relaxCol.imageAlt).toBe("Updated Relax collection photo");
  });

  it("resolves branch image prioritizing branch override > marketing fallback > default spa image", () => {
    expect(
      resolvePublicBranchImage(
        {
          id: "b-1",
          name: "SM City",
          imageUrl:
            "https://lsrbwqhvzjfpiabeolkv.supabase.co/storage/v1/object/public/public-site-media/branches/sm.webp",
        },
        "/images/spa/booking.jpg"
      )
    ).toContain("/branches/sm.webp");

    expect(
      resolvePublicBranchImage({ id: "b-2", name: "La Luz", imageUrl: null }, "/images/spa/booking.jpg")
    ).toBe("/images/spa/booking.jpg");

    expect(resolvePublicBranchImage({ id: "b-3", name: "New", imageUrl: null })).toBe(
      "/images/spa/contact.jpg"
    );
  });
});

describe("mobile & public Next/Image rendering without raw <img> tags", () => {
  it("renders all optimized mobile sections and admin thumbnail with <Image> (no raw <img>)", () => {
    const sampleService = makeCatalogService();
    const markup = renderToStaticMarkup(
      <>
        <MobileHomeHeroCarousel />
        <MobileCalmCategories services={[sampleService]} />
        <MobileMostLovedTreatments services={[sampleService]} />
        <MobileSignatureRituals services={[sampleService]} boutiqueProducts={BOUTIQUE_PRODUCTS} />
        <MobileBranchesSection
          branches={[{ id: "b-1", name: "SM City Bacolod", imageUrl: null, address: "SM", phone: "123" }]}
        />
        <MobileFinalCta />
        <ServiceImageThumbnail
          serviceId={sampleService.id}
          serviceName={sampleService.name}
          imageUrl={sampleService.imageUrl}
          imageAlt={sampleService.imageAlt}
        />
      </>
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain("data-next-image=");
  });
});
