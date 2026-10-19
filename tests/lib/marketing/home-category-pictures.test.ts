import { describe, expect, it } from "vitest";
import {
  PUBLIC_CATALOG_CATEGORY_NAMES,
  getPublicHomeCategoryImage,
} from "@/lib/public/service-catalog-config";
import {
  resolvePublicSiteSections,
  type PublicSiteSectionRow,
} from "@/lib/public/normalized-sections";

function sectionWithImages(categoryImages: unknown): PublicSiteSectionRow {
  return {
    section_key: "signature_services",
    title: "Explore our services",
    is_enabled: true,
    metadata: { categoryImages },
  } as unknown as PublicSiteSectionRow;
}

describe("managed homepage category pictures", () => {
  it("provides safe canonical fallback images for all five categories", () => {
    const normalized = resolvePublicSiteSections([]);
    expect(PUBLIC_CATALOG_CATEGORY_NAMES).toHaveLength(5);
    expect(normalized.signatureServices.categoryImages).toEqual({});
    for (const category of PUBLIC_CATALOG_CATEGORY_NAMES) {
      expect(getPublicHomeCategoryImage(category).startsWith("/images/")).toBe(true);
    }
  });

  it("resolves independently published category pictures without changing the other covers", () => {
    const updated = "https://cdn.example.com/skin-care-replacement.webp";
    const normalized = resolvePublicSiteSections([
      sectionWithImages({ "Skin Care Services": updated }),
    ]);
    expect(normalized.signatureServices.categoryImages["Skin Care Services"]).toBe(updated);
    expect(normalized.signatureServices.categoryImages["Salon Services"]).toBeUndefined();
    expect(getPublicHomeCategoryImage("Salon Services")).toBeTruthy();
  });

  it("ignores unrecognized category names, non-string values and unsafe protocols", () => {
    const normalized = resolvePublicSiteSections([
      sectionWithImages({
        "Unknown Category": "/images/other.jpg",
        "Massage Services": "javascript:alert(1)",
        "Salon Services": "//untrusted.example/image.jpg",
        "Skin Care Services": 123,
        "Spa Party Packages": "/images/new-spa-party.jpg",
      }),
    ]);
    expect(normalized.signatureServices.categoryImages).toEqual({
      "Spa Party Packages": "/images/new-spa-party.jpg",
    });
  });
});
