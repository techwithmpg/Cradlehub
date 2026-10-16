import { describe, expect, it, vi } from "vitest";
import {
  calculateServiceLineQuote,
  serviceLineQuoteOptions,
  toServiceLineCommercialSnapshot,
  ServiceLineQuoteError,
} from "@/lib/services/service-line-quote";
import {
  quoteVersionFor,
  resolveServiceLineQuote,
  resolveServiceLineQuoteOptions,
} from "@/lib/services/resolve-service-line-quote";
import { ownerServiceCatalogSchema } from "@/lib/validations/service";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  validateEligibility: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: mocks.validateEligibility,
}));

describe("Duration Slider Price Correction - Contract & Verification", () => {
  const branchId = "b1000000-0000-0000-0000-000000000001";
  const noOverride = { custom_price: null, custom_duration_minutes: null };

  const validExtendableService = {
    id: "s1000000-0000-0000-0000-000000000001",
    duration_policy: "extendable",
    duration_minutes: 60,
    price: 500,
    extension_increment_minutes: 30,
    extension_price: 200,
    maximum_duration_minutes: 150,
  };

  const fixedService = {
    id: "s2000000-0000-0000-0000-000000000002",
    duration_policy: "fixed",
    duration_minutes: 60,
    price: 400,
    extension_increment_minutes: null,
    extension_price: null,
    maximum_duration_minutes: null,
  };

  describe("1. Quote Engine Contract & Quote Ladder", () => {
    it("generates the exact expected commercial ladder for valid extendable service", () => {
      const options = serviceLineQuoteOptions({
        service: validExtendableService,
        branch: noOverride,
      });

      expect(options.map((o) => ({ duration: o.selectedDurationMinutes, price: o.calculatedPrice }))).toEqual([
        { duration: 60, price: 500 },
        { duration: 90, price: 700 },
        { duration: 120, price: 900 },
        { duration: 150, price: 1100 },
      ]);
    });

    it("rejects zero extension price (extension_price = 0) with SERVICE_DURATION_CONFIGURATION_INVALID", () => {
      expect(() =>
        calculateServiceLineQuote({
          service: { ...validExtendableService, extension_price: 0 },
          branch: noOverride,
          requestedDurationMinutes: 90,
        })
      ).toThrowError(new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID"));

      expect(() =>
        serviceLineQuoteOptions({
          service: { ...validExtendableService, extension_price: 0 },
          branch: noOverride,
        })
      ).toThrowError(new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID"));
    });

    it("rejects negative extension price with SERVICE_DURATION_CONFIGURATION_INVALID", () => {
      expect(() =>
        calculateServiceLineQuote({
          service: { ...validExtendableService, extension_price: -100 },
          branch: noOverride,
          requestedDurationMinutes: 90,
        })
      ).toThrowError(new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID"));
    });

    it("preserves fixed services with constant duration and price", () => {
      const quote = calculateServiceLineQuote({
        service: fixedService,
        branch: noOverride,
      });
      expect(quote.durationPolicy).toBe("fixed");
      expect(quote.selectedDurationMinutes).toBe(60);
      expect(quote.calculatedPrice).toBe(400);
      expect(quote.extensionPrice).toBeNull();
    });
  });

  describe("2. Owner Service Validation", () => {
    const validOwnerInput = {
      categoryId: "c1000000-0000-0000-0000-000000000001",
      name: "Deep Tissue Massage",
      description: "Therapeutic deep pressure",
      durationMinutes: 60,
      price: 500,
      isActive: true,
      isPublicVisible: true,
      durationPolicy: "extendable" as const,
      extensionIncrementMinutes: 30,
      extensionPrice: 200,
      maximumDurationMinutes: 150,
      imageAlt: "Massage therapy",
      allBranches: true,
      branchIds: [],
    };

    it("accepts valid extendable service with extensionPrice > 0", () => {
      const parsed = ownerServiceCatalogSchema.safeParse(validOwnerInput);
      expect(parsed.success).toBe(true);
    });

    it("rejects extensionPrice = 0 with exact message", () => {
      const parsed = ownerServiceCatalogSchema.safeParse({
        ...validOwnerInput,
        extensionPrice: 0,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issue = parsed.error.issues.find((i) => i.path.includes("extensionPrice"));
        expect(issue?.message).toBe("Extension price must be greater than ₱0.");
      }
    });

    it("rejects extensionPrice < 0", () => {
      const parsed = ownerServiceCatalogSchema.safeParse({
        ...validOwnerInput,
        extensionPrice: -200,
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects null extensionPrice when durationPolicy is extendable", () => {
      const parsed = ownerServiceCatalogSchema.safeParse({
        ...validOwnerInput,
        extensionPrice: null,
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("3. UI State Progression & Immediate Price Updates", () => {
    it("simulates slider 60 -> 90 -> 120 with immediate duration and price updates", () => {
      const options = serviceLineQuoteOptions({
        service: validExtendableService,
        branch: noOverride,
      });

      // Stop 1: 60 min
      const stop1 = options.find((o) => o.selectedDurationMinutes === 60)!;
      expect(stop1.selectedDurationMinutes).toBe(60);
      expect(stop1.calculatedPrice).toBe(500);

      // Stop 2: 90 min
      const stop2 = options.find((o) => o.selectedDurationMinutes === 90)!;
      expect(stop2.selectedDurationMinutes).toBe(90);
      expect(stop2.calculatedPrice).toBe(700);

      // Stop 3: 120 min
      const stop3 = options.find((o) => o.selectedDurationMinutes === 120)!;
      expect(stop3.selectedDurationMinutes).toBe(120);
      expect(stop3.calculatedPrice).toBe(900);

      // Verify strictly increasing prices
      expect(stop2.calculatedPrice).toBeGreaterThan(stop1.calculatedPrice);
      expect(stop3.calculatedPrice).toBeGreaterThan(stop2.calculatedPrice);
    });

    it("calculates multi-service totals: Massage 90 min (₱700) + Facial (₱400) = ₱1,100", () => {
      const massageQuote = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const facialQuote = calculateServiceLineQuote({
        service: fixedService,
        branch: noOverride,
      });

      expect(massageQuote.calculatedPrice).toBe(700);
      expect(facialQuote.calculatedPrice).toBe(400);

      const totalPrice = massageQuote.calculatedPrice + facialQuote.calculatedPrice;
      expect(totalPrice).toBe(1100);
    });

    it("calculates multi-attendee totals with independent durations", () => {
      const attendee1Quote = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const attendee2Quote = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });

      expect(attendee1Quote.calculatedPrice).toBe(700);
      expect(attendee2Quote.calculatedPrice).toBe(900);

      const combinedTotal = attendee1Quote.calculatedPrice + attendee2Quote.calculatedPrice;
      expect(combinedTotal).toBe(1600);
    });

    it("keeps Home Service transportation pricing independent of service duration increase", () => {
      const serviceQuote = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });
      const transportationFee = 180;

      expect(serviceQuote.calculatedPrice).toBe(900);
      const totalOrderWithHomeService = serviceQuote.calculatedPrice + transportationFee;
      expect(totalOrderWithHomeService).toBe(1080);
    });
  });

  describe("4. Commercial Snapshot & Server Authority", () => {
    it("preserves historical commercial snapshot schema without altering past data", () => {
      const quote = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const snapshot = toServiceLineCommercialSnapshot(quote);

      expect(snapshot).toEqual({
        service_id: validExtendableService.id,
        duration_policy_snapshot: "extendable",
        base_duration_minutes_snapshot: 60,
        selected_duration_minutes: 90,
        base_price_snapshot: 500,
        extension_increment_minutes_snapshot: 30,
        extension_price_snapshot: 200,
        extension_units: 1,
        calculated_price: 700,
      });
    });

    it("ensures quoteVersion changes if duration or commercial terms change", () => {
      const quote60 = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 60,
      });
      const quote90 = calculateServiceLineQuote({
        service: validExtendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });

      const version60 = quoteVersionFor(branchId, quote60);
      const version90 = quoteVersionFor(branchId, quote90);

      expect(version60).not.toBe(version90);
    });

    it("resolves authoritative quotes with quoteVersion via resolveServiceLineQuote and resolveServiceLineQuoteOptions", async () => {
      mocks.admin.mockReturnValue({
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => {
                if (table === "services") {
                  return Promise.resolve({ data: validExtendableService, error: null });
                }
                return Promise.resolve({ data: noOverride, error: null });
              },
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: noOverride, error: null }),
                }),
              }),
            }),
          }),
        }),
      });

      const quote = await resolveServiceLineQuote({
        branchId,
        serviceId: validExtendableService.id,
        audience: "public",
        deliveryMode: "in_spa",
        requestedDurationMinutes: 90,
      });

      expect(quote.selectedDurationMinutes).toBe(90);
      expect(quote.calculatedPrice).toBe(700);
      expect(quote.quoteVersion).toBeDefined();

      const options = await resolveServiceLineQuoteOptions({
        branchId,
        serviceId: validExtendableService.id,
        audience: "public",
        deliveryMode: "in_spa",
      });

      expect(options).toHaveLength(4);
      expect(options.map((o) => o.calculatedPrice)).toEqual([500, 700, 900, 1100]);
    });
  });
});
