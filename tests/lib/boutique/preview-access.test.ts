import { describe, expect, it } from "vitest";
import { canViewBoutiquePreviewWorkspace } from "@/lib/boutique/preview-access";

describe("Boutique B1 read-only workspace policy", () => {
  it("allows owner only in owner preview", () => {
    expect(canViewBoutiquePreviewWorkspace("owner", "owner", null)).toBe(true);
    expect(canViewBoutiquePreviewWorkspace("crm", "owner", "branch-1")).toBe(false);
    expect(canViewBoutiquePreviewWorkspace("digital_marketer", "owner", null)).toBe(false);
  });

  it("requires assigned branch and CRM identity on CRM preview", () => {
    expect(canViewBoutiquePreviewWorkspace("crm", "crm", "branch-1")).toBe(true);
    expect(canViewBoutiquePreviewWorkspace("crm", "crm", "")).toBe(false);
    expect(canViewBoutiquePreviewWorkspace("crm", "crm", null)).toBe(false);
    expect(canViewBoutiquePreviewWorkspace("owner", "crm", "branch-1")).toBe(false);
    for (const role of ["manager", "assistant_manager", "store_manager", "driver", "utility", "staff", "digital_marketer"]) {
      expect(canViewBoutiquePreviewWorkspace(role, "crm", "branch-1")).toBe(false);
    }
  });
});
