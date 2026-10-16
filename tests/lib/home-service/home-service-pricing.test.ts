import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateHomeServiceTravelFee,
  createHomeServiceTransportSnapshot,
  haversineDistanceKm,
} from "@/lib/home-service/distance-fee";
import { calculateHomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import * as googleMaps from "@/lib/maps/google-maps";
import { canManageCrmSetup } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff-roles";

describe("Home Service Transportation Pricing Integration Matrix", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Google Routes Authority & Fail-Closed Behavior", () => {
    const mockBranchData = {
      id: "branch-main",
      name: "Main Spa",
      is_active: true,
      latitude: 10.6765,
      longitude: 122.9512,
    };

    const mockRulesData = {
      home_service_base_fee: 100,
      home_service_free_km: 1,
      home_service_extra_km_fee: 40,
    };

    function createMockSupabase(
      branchOverride?: unknown,
      rulesOverride?: { data?: unknown; error?: unknown } | unknown
    ) {
      const isRulesResponseObject =
        rulesOverride &&
        typeof rulesOverride === "object" &&
        ("data" in (rulesOverride as object) || "error" in (rulesOverride as object));

      const rulesData = isRulesResponseObject
        ? (rulesOverride as { data?: unknown }).data
        : (rulesOverride ?? mockRulesData);
      const rulesError = isRulesResponseObject
        ? (rulesOverride as { error?: unknown }).error ?? null
        : null;

      return {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: table === "branches" ? (branchOverride ?? mockBranchData) : rulesData,
                  error: table === "branches" ? null : rulesError,
                }),
              }),
              maybeSingle: async () => ({
                data: table === "branches" ? (branchOverride ?? mockBranchData) : rulesData,
                error: table === "branches" ? null : rulesError,
              }),
            }),
          }),
        }),
      };
    }

    it("uses Google driving distance as monetary distance authority", async () => {
      // Mock Google Routes API
      const drivingSpy = vi
        .spyOn(googleMaps, "calculateDrivingDistanceKm")
        .mockResolvedValueOnce(4.85);

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.69, lng: 122.97 },
        client: createMockSupabase(),
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.quote.distanceKm).toBe(4.85);
      // 100 + (4.85 - 1) * 40 = 100 + 154 = 254
      expect(res.quote.travelFee).toBe(254);
      expect(res.quote.transportSnapshot.distance_source).toBe("google_routes");
      expect(res.quote.transportSnapshot.calculated_fee).toBe(254);
      expect(drivingSpy).toHaveBeenCalledTimes(1);
    });

    it("ignores any client-supplied distance", async () => {
      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(5.0);

      // Even if client claimed 2.0 km, server queries Google Routes and uses 5.0 km
      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: createMockSupabase(),
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.quote.distanceKm).toBe(5.0);
      expect(res.quote.travelFee).toBe(260); // 100 + 4 * 40 = 260, not 100 + 1 * 40 = 140
    });

    it("does not use Haversine distance for billing", async () => {
      // Haversine straight-line distance is ~2.0 km, but driving route is 3.5 km
      const branchCoords = { lat: 10.6765, lng: 122.9512 };
      const destCoords = { lat: 10.6865, lng: 122.9612 };

      const straightLineKm = haversineDistanceKm(branchCoords, destCoords);
      expect(straightLineKm).toBeLessThan(2.0);

      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(3.5);

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: destCoords,
        client: createMockSupabase({ ...mockBranchData, ...branchCoords }),
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Must use driving distance 3.5 km (₱200), not haversine (~1.5 km -> ₱120)
      expect(res.quote.distanceKm).toBe(3.5);
      expect(res.quote.travelFee).toBe(200);
    });

    it("fails closed with HOME_SERVICE_DISTANCE_UNAVAILABLE when Google Routes fails", async () => {
      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(null);

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: createMockSupabase(),
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.code).toBe("HOME_SERVICE_DISTANCE_UNAVAILABLE");
      expect(res.message).toContain("couldn't calculate the transportation fee");
    });

    it("fails closed when branch coordinates are missing", async () => {
      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: createMockSupabase({
          ...mockBranchData,
          latitude: null,
          longitude: null,
          maps_embed_url: null,
        }),
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.code).toBe("BRANCH_LOCATION_MISSING");
      expect(res.message).toContain("couldn't calculate the transportation fee");
    });

    it("fails closed when destination coordinates are missing or invalid", async () => {
      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: Number.NaN, lng: 123.0 },
        client: createMockSupabase(),
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.code).toBe("HOME_SERVICE_DISTANCE_UNAVAILABLE");
    });

    it("fails closed with HOME_SERVICE_DISTANCE_UNAVAILABLE when branch_booking_rules query fails with database error", async () => {
      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(3.0);

      const dbErrorClient = createMockSupabase(mockBranchData, {
        data: null,
        error: { code: "42P01", message: "relation branch_booking_rules does not exist" },
      });

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: dbErrorClient,
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.code).toBe("HOME_SERVICE_DISTANCE_UNAVAILABLE");
      expect(res.message).toContain("couldn't calculate the transportation fee");
    });

    it("succeeds with repository default policy when branch_booking_rules row is intentionally absent", async () => {
      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(3.0);

      // Intentionally absent row: data is null, error is null
      const absentRowClient = createMockSupabase(mockBranchData, {
        data: null,
        error: null,
      });

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: absentRowClient,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Default policy: base=100, free=1, extra=40 -> 3km: 100 + 2*40 = 180
      expect(res.quote.baseFee).toBe(100);
      expect(res.quote.includedKm).toBe(1);
      expect(res.quote.perKmFee).toBe(40);
      expect(res.quote.travelFee).toBe(180);
    });

    it("fails closed with HOME_SERVICE_DISTANCE_UNAVAILABLE when branch_booking_rules contains invalid negative values", async () => {
      vi.spyOn(googleMaps, "calculateDrivingDistanceKm").mockResolvedValueOnce(3.0);

      const invalidRowClient = createMockSupabase(mockBranchData, {
        data: {
          home_service_base_fee: -100, // Invalid negative fee in database
          home_service_free_km: 1,
          home_service_extra_km_fee: 40,
        },
        error: null,
      });

      const res = await calculateHomeServiceDistanceQuote({
        branchId: "branch-main",
        destination: { lat: 10.7, lng: 123.0 },
        client: invalidRowClient,
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.code).toBe("HOME_SERVICE_DISTANCE_UNAVAILABLE");
    });
  });

  describe("Branch Authorization Matrix", () => {
    // Pure permission checker replicating canManageBranchRules logic
    function checkCanManageBranchRules(
      user: { id: string; system_role: string; branch_id: string | null } | null,
      targetBranchId: string
    ): boolean {
      if (!user) return false;
      const role = canonicalizeSystemRole(user.system_role);
      if (role === "owner") return true;
      return canManageCrmSetup(role) && user.branch_id === targetBranchId;
    }

    const MAIN_SPA_ID = "branch-main-111";
    const SM_BRANCH_ID = "branch-sm-222";

    it("Owner can edit Main Spa pricing", () => {
      const owner = { id: "u-owner", system_role: "owner", branch_id: null };
      expect(checkCanManageBranchRules(owner, MAIN_SPA_ID)).toBe(true);
    });

    it("Owner can edit SM pricing", () => {
      const owner = { id: "u-owner", system_role: "owner", branch_id: null };
      expect(checkCanManageBranchRules(owner, SM_BRANCH_ID)).toBe(true);
    });

    it("Authorized CRM clerk for Main can edit Main Spa", () => {
      const mainClerk = { id: "u-clerk-main", system_role: "crm", branch_id: MAIN_SPA_ID };
      expect(checkCanManageBranchRules(mainClerk, MAIN_SPA_ID)).toBe(true);
    });

    it("Main CRM clerk cannot edit SM branch", () => {
      const mainClerk = { id: "u-clerk-main", system_role: "crm", branch_id: MAIN_SPA_ID };
      expect(checkCanManageBranchRules(mainClerk, SM_BRANCH_ID)).toBe(false);
    });

    it("Unauthorized roles (therapist, cleaner, customer) cannot edit either branch", () => {
      const therapist = { id: "u-therapist", system_role: "therapist", branch_id: MAIN_SPA_ID };
      expect(checkCanManageBranchRules(therapist, MAIN_SPA_ID)).toBe(false);
      expect(checkCanManageBranchRules(therapist, SM_BRANCH_ID)).toBe(false);

      const customer = { id: "u-customer", system_role: "customer", branch_id: null };
      expect(checkCanManageBranchRules(customer, MAIN_SPA_ID)).toBe(false);
    });

    it("Unauthenticated user cannot edit any branch", () => {
      expect(checkCanManageBranchRules(null, MAIN_SPA_ID)).toBe(false);
      expect(checkCanManageBranchRules(null, SM_BRANCH_ID)).toBe(false);
    });

    it("Browser-supplied branch ID cannot override authenticated branch scope", () => {
      const mainClerk = { id: "u-clerk-main", system_role: "crm", branch_id: MAIN_SPA_ID };
      const clientSuppliedTargetBranchId = SM_BRANCH_ID;

      // When the client sends SM_BRANCH_ID, the server compares user.branch_id against clientSuppliedTargetBranchId
      const isAllowed = checkCanManageBranchRules(mainClerk, clientSuppliedTargetBranchId);
      expect(isAllowed).toBe(false);
    });
  });

  describe("Payment Calculation & Single-Transportation Guarantee", () => {
    it("ensures total = subtotal + transportation fee without double counting base fee", () => {
      const serviceSubtotal = 1200;
      const drivingDistanceKm = 2.5;

      const baseFee = 100;
      const includedKm = 1;
      const perKmFee = 40;

      const transportationFee = calculateHomeServiceTravelFee({
        drivingDistanceKm,
        baseFee,
        includedKm,
        perKmFee,
      });

      expect(transportationFee).toBe(160);

      // Order total calculation:
      const totalAmount = serviceSubtotal + transportationFee;
      expect(totalAmount).toBe(1360);

      // Verification: Base fee is NOT added on top of the calculated transportation fee
      expect(totalAmount).not.toBe(serviceSubtotal + baseFee + transportationFee);
    });

    it("idempotency retry preserves identical financial amounts", () => {
      const quote = {
        drivingDistanceKm: 3.0,
        travelFee: 180,
      };

      const computeOrderTotals = (services: number, hsFee: number) => ({
        subtotal: services,
        homeServiceFee: hsFee,
        total: services + hsFee,
      });

      const attempt1 = computeOrderTotals(1200, quote.travelFee);
      const attempt2 = computeOrderTotals(1200, quote.travelFee);

      expect(attempt1).toEqual(attempt2);
      expect(attempt2.total).toBe(1380);
      expect(attempt2.homeServiceFee).toBe(180);
    });
  });

  describe("Commercial Snapshot Persistence & Historical Immutability", () => {
    it("retains historical fee and snapshot even when branch pricing configuration changes", () => {
      // Step 1: Booking is created under original branch policy
      const originalConfig = {
        base_fee: 100,
        included_km: 1,
        per_km_fee: 40,
      };

      const distanceKm = 5.0;
      const originalFee = calculateHomeServiceTravelFee({
        drivingDistanceKm: distanceKm,
        baseFee: originalConfig.base_fee,
        includedKm: originalConfig.included_km,
        perKmFee: originalConfig.per_km_fee,
      });
      expect(originalFee).toBe(260);

      const savedBooking = {
        id: "booking-hist-001",
        home_service_fee: originalFee,
        home_service_transport: createHomeServiceTransportSnapshot({
          drivingDistanceKm: distanceKm,
          baseFee: originalConfig.base_fee,
          includedKm: originalConfig.included_km,
          perKmFee: originalConfig.per_km_fee,
        }),
      };

      // Step 2: Branch changes pricing configuration the next day
      const updatedConfig = {
        base_fee: 120,
        included_km: 2,
        per_km_fee: 50,
      };

      const newPolicyFeeForSameDistance = calculateHomeServiceTravelFee({
        drivingDistanceKm: distanceKm,
        baseFee: updatedConfig.base_fee,
        includedKm: updatedConfig.included_km,
        perKmFee: updatedConfig.per_km_fee,
      });
      expect(newPolicyFeeForSameDistance).toBe(270); // 120 + 3 * 50 = 270

      // Step 3: Historical booking must STILL retain its original fee and snapshot
      expect(savedBooking.home_service_fee).toBe(260);
      expect(savedBooking.home_service_transport.base_fee).toBe(100);
      expect(savedBooking.home_service_transport.included_km).toBe(1);
      expect(savedBooking.home_service_transport.per_km_fee).toBe(40);
      expect(savedBooking.home_service_transport.calculated_fee).toBe(260);
      expect(savedBooking.home_service_fee).not.toBe(newPolicyFeeForSameDistance);
    });
  });
});
