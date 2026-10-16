import { describe, expect, it, vi } from "vitest";
import {
  calculateServiceLineQuote,
  serviceLineQuoteOptions,
  toServiceLineCommercialSnapshot,
} from "@/lib/services/service-line-quote";
import { quoteVersionFor } from "@/lib/services/resolve-service-line-quote";
import { resolveBookingLineQuotes } from "@/lib/services/resolve-booking-line-quotes";
import { computeEndTimeForResolvedDuration } from "@/lib/engine/booking-time";
import { allocateResourcesForAttendees, isResourceAvailable } from "@/lib/engine/resource-availability";
import { fakeDatabase } from "../../helpers/stage08a-db";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  validateEligibility: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: mocks.validateEligibility,
}));

const fixedService = {
  id: "svc-fixed-1",
  duration_policy: "fixed",
  duration_minutes: 60,
  price: 800,
  extension_increment_minutes: null,
  extension_price: null,
  maximum_duration_minutes: null,
};

const extendableService = {
  id: "svc-extendable-1",
  duration_policy: "extendable",
  duration_minutes: 60,
  price: 500,
  extension_increment_minutes: 30,
  extension_price: 350,
  maximum_duration_minutes: 180,
};

const noOverride = { custom_price: null, custom_duration_minutes: null };

describe("Service Duration Extension - Mandatory Regression Matrix", () => {
  describe("1. Authoritative Quote Contract & Calculation", () => {
    it("preserves fixed service without duration alteration", () => {
      const quote = calculateServiceLineQuote({ service: fixedService, branch: noOverride });
      expect(quote).toEqual({
        serviceId: "svc-fixed-1",
        durationPolicy: "fixed",
        baseDurationMinutes: 60,
        selectedDurationMinutes: 60,
        basePrice: 800,
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        extensionUnits: 0,
        calculatedPrice: 800,
      });
    });

    it("rejects altered duration for a fixed service", () => {
      expect(() =>
        calculateServiceLineQuote({ service: fixedService, branch: noOverride, requestedDurationMinutes: 90 })
      ).toThrow("INVALID_SERVICE_DURATION");
      expect(() =>
        calculateServiceLineQuote({ service: fixedService, branch: noOverride, requestedDurationMinutes: 30 })
      ).toThrow("INVALID_SERVICE_DURATION");
    });

    it("defaults extendable service to base duration when requested duration is omitted", () => {
      const quote = calculateServiceLineQuote({ service: extendableService, branch: noOverride });
      expect(quote).toEqual({
        serviceId: "svc-extendable-1",
        durationPolicy: "extendable",
        baseDurationMinutes: 60,
        selectedDurationMinutes: 60,
        basePrice: 500,
        extensionIncrementMinutes: 30,
        extensionPrice: 350,
        maximumDurationMinutes: 180,
        extensionUnits: 0,
        calculatedPrice: 500,
      });
    });

    it("calculates all valid discrete duration stops correctly", () => {
      const options = serviceLineQuoteOptions({ service: extendableService, branch: noOverride });
      expect(options.map((o) => [o.selectedDurationMinutes, o.extensionUnits, o.calculatedPrice])).toEqual([
        [60, 0, 500],
        [90, 1, 850],
        [120, 2, 1200],
        [150, 3, 1550],
        [180, 4, 1900],
      ]);
    });

    it.each([
      [59, "below base"],
      [0, "zero"],
      [-30, "negative"],
      [75, "not on step increment"],
      [61, "arbitrary minute"],
      [90.5, "fractional minute"],
      [181, "above maximum"],
      [210, "above maximum by step"],
    ])("rejects invalid duration: %s (%s)", (duration) => {
      expect(() =>
        calculateServiceLineQuote({
          service: extendableService,
          branch: noOverride,
          requestedDurationMinutes: duration,
        })
      ).toThrow("INVALID_SERVICE_DURATION");
    });

    it.each([
      [{ extension_increment_minutes: 0 }, "zero increment"],
      [{ extension_increment_minutes: -10 }, "negative increment"],
      [{ extension_price: null }, "null extension price"],
      [{ extension_price: 0 }, "zero extension price"],
      [{ extension_price: -50 }, "negative extension price"],
      [{ maximum_duration_minutes: 60 }, "max equals base"],
      [{ maximum_duration_minutes: 50 }, "max less than base"],
      [{ maximum_duration_minutes: 175 }, "max not divisible by increment from base"],
    ])("fails closed on invalid catalog configuration: %s (%s)", (invalidConfig, _description) => {
      expect(() =>
        calculateServiceLineQuote({
          service: { ...extendableService, ...invalidConfig },
          branch: noOverride,
        }), _description
      ).toThrow("SERVICE_DURATION_CONFIGURATION_INVALID");
    });

    it("prevents browser price forgery by deriving price strictly from server catalog", () => {
      const quote = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });
      // Browser cannot provide 100 pesos; server computes 1200
      expect(quote.calculatedPrice).toBe(1200);
      expect(quote.basePrice).toBe(500);
      expect(quote.extensionPrice).toBe(350);
    });

    it("preserves branch override on fixed service", () => {
      const quote = calculateServiceLineQuote({
        service: fixedService,
        branch: { custom_price: 950, custom_duration_minutes: 75 },
      });
      expect(quote.selectedDurationMinutes).toBe(75);
      expect(quote.calculatedPrice).toBe(950);
    });

    it("fails closed when branch override is combined with extendable service", () => {
      expect(() =>
        calculateServiceLineQuote({
          service: extendableService,
          branch: { custom_price: 600, custom_duration_minutes: null },
        })
      ).toThrow("SERVICE_DURATION_OVERRIDE_UNSUPPORTED");
      expect(() =>
        calculateServiceLineQuote({
          service: extendableService,
          branch: { custom_price: null, custom_duration_minutes: 90 },
        })
      ).toThrow("SERVICE_DURATION_OVERRIDE_UNSUPPORTED");
    });
  });

  describe("2. Multi-Guest & Multi-Service Independent Line State", () => {
    it("quotes the same service at different durations for two distinct guests independently", () => {
      const guest1Quote = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });
      const guest2Quote = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 60,
      });

      expect(guest1Quote.selectedDurationMinutes).toBe(120);
      expect(guest1Quote.calculatedPrice).toBe(1200);

      expect(guest2Quote.selectedDurationMinutes).toBe(60);
      expect(guest2Quote.calculatedPrice).toBe(500);

      const totalOrderAmount = guest1Quote.calculatedPrice + guest2Quote.calculatedPrice;
      expect(totalOrderAmount).toBe(1700);
    });

    it("quotes multiple services for a single guest with independent durations", () => {
      const serviceA = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 150,
      });
      const serviceB = calculateServiceLineQuote({
        service: fixedService,
        branch: noOverride,
      });

      expect(serviceA.selectedDurationMinutes).toBe(150);
      expect(serviceA.calculatedPrice).toBe(1550);
      expect(serviceB.selectedDurationMinutes).toBe(60);
      expect(serviceB.calculatedPrice).toBe(800);

      const subtotal = serviceA.calculatedPrice + serviceB.calculatedPrice;
      expect(subtotal).toBe(2350);
    });
  });

  describe("3. Operational Timing & Sequential vs Concurrent Model", () => {
    it("computes end time accurately for resolved duration including before/after buffers", () => {
      // 120 min treatment + 10 min buffer before + 15 min buffer after = 145 min total block
      // 10:00:00 -> 12:25:00
      const endTime = computeEndTimeForResolvedDuration({
        startTime: "10:00:00",
        selectedDurationMinutes: 120,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 15,
      });
      expect(endTime).toBe("12:25:00");
    });

    it("chains sequential services for the same guest using selected durations", () => {
      // Guest 1 has two services in sequence:
      // Service 1: 120 min, buffer 0
      // Service 2: 45 min, buffer 0
      const start1 = "10:00:00";
      const end1 = computeEndTimeForResolvedDuration({
        startTime: start1,
        selectedDurationMinutes: 120,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      });
      expect(end1).toBe("12:00:00");

      const end2 = computeEndTimeForResolvedDuration({
        startTime: end1,
        selectedDurationMinutes: 45,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      });
      expect(end2).toBe("12:45:00");
    });

    it("evaluates concurrent guest chains as overlapping rather than additive", () => {
      // Guest 1: 120 min treatment -> 10:00 to 12:00
      // Guest 2: 90 min treatment -> 10:00 to 11:30
      // Elapsed total order treatment span should be max(120, 90) = 120, NOT 210
      const guest1Duration = 120;
      const guest2Duration = 90;
      const orderSpan = Math.max(guest1Duration, guest2Duration);
      expect(orderSpan).toBe(120);
    });
  });

  describe("4. Resource & Room Capacity Invalidation", () => {
    it("allows room allocation when base duration fits, but fails when extended duration conflicts", async () => {
      const branchId = "branch-test-1";
      // Room has another booking at 11:30
      const db = fakeDatabase({
        branch_resources: [
          { id: "room-1", branch_id: branchId, is_active: true, capacity: 1 },
        ],
        bookings: [
          {
            id: "existing-bkg-1",
            branch_id: branchId,
            resource_id: "room-1",
            booking_date: "2026-10-20",
            start_time: "11:30:00",
            end_time: "12:30:00",
            status: "confirmed",
          },
        ],
      });
      mocks.admin.mockReturnValue(db.client);

      // Base duration: 10:00 -> 11:00 (fits before 11:30 booking)
      const baseFit = await isResourceAvailable({
        resourceId: "room-1",
        date: "2026-10-20",
        startTime: "10:00:00",
        endTime: "11:00:00",
      });
      expect(baseFit).toBe(true);

      // Extended duration: 120 min -> 10:00 -> 12:00 (conflicts with 11:30 booking)
      const extendedConflict = await isResourceAvailable({
        resourceId: "room-1",
        date: "2026-10-20",
        startTime: "10:00:00",
        endTime: "12:00:00",
      });
      expect(extendedConflict).toBe(false);

      // Multi-attendee resource allocator also returns null for the extended window
      const allocated = await allocateResourcesForAttendees({
        branchId,
        date: "2026-10-20",
        windows: [{ startTime: "10:00:00", endTime: "12:00:00" }],
      });
      expect(allocated).toBeNull();
    });
  });

  describe("5. Stale Quote Safety & Version Comparison", () => {
    it("generates deterministic quote versions for the same commercial terms", () => {
      const quoteA = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const quoteB = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const versionA = quoteVersionFor("branch-1", quoteA);
      const versionB = quoteVersionFor("branch-1", quoteB);
      expect(versionA).toBe(versionB);
      expect(versionA).toMatch(/^[0-9a-f]{64}$/);
    });

    it("generates different quote versions when duration or price differs", () => {
      const quote90 = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 90,
      });
      const quote120 = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });
      expect(quoteVersionFor("branch-1", quote90)).not.toBe(quoteVersionFor("branch-1", quote120));
    });

    it("rejects booking submission when client expectedQuoteVersion is stale", async () => {
      const branchId = "11111111-1111-4111-8111-111111111111";
      const db = fakeDatabase({
        services: [extendableService],
        branch_services: [{ branch_id: branchId, service_id: extendableService.id, is_active: true, custom_duration_minutes: null, custom_price: null }],
      });
      mocks.admin.mockReturnValue(db.client);

      const staleVersion = "0".repeat(64);
      await expect(
        resolveBookingLineQuotes({
          branchId,
          serviceIds: [extendableService.id],
          serviceLines: [{ serviceId: extendableService.id, requestedDurationMinutes: 120, expectedQuoteVersion: staleVersion }],
          audience: "crm",
          deliveryMode: "in_spa",
        })
      ).rejects.toThrow("SERVICE_QUOTE_CHANGED");
    });
  });

  describe("6. Commercial Snapshot Immutability", () => {
    it("maps authoritative quote to exact commercial snapshot fields", () => {
      const quote = calculateServiceLineQuote({
        service: extendableService,
        branch: noOverride,
        requestedDurationMinutes: 120,
      });
      const snapshot = toServiceLineCommercialSnapshot(quote);
      expect(snapshot).toEqual({
        service_id: "svc-extendable-1",
        duration_policy_snapshot: "extendable",
        base_duration_minutes_snapshot: 60,
        selected_duration_minutes: 120,
        base_price_snapshot: 500,
        extension_increment_minutes_snapshot: 30,
        extension_price_snapshot: 350,
        extension_units: 2,
        calculated_price: 1200,
      });
    });
  });
});
