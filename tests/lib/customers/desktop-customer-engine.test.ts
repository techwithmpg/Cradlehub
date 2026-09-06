import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  executeDesktopCustomerList,
  executeDesktopCustomerDetail,
  type DesktopCustomerExecutionContext,
} from "@/lib/customers/desktop-customer-engine";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const BRANCH_AAA = "11111111-1111-1111-1111-111111111111";
const BRANCH_BBB = "22222222-2222-2222-2222-222222222222";
const CUSTOMER_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CUSTOMER_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const STAFF_1 = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("Desktop Customer Engine - Unit Tests", () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn(),
    };
  });

  function makeContext(operator: InhouseBookingOperator): DesktopCustomerExecutionContext {
    return {
      operator,
      supabase: mockSupabase as unknown as SupabaseClient<Database>,
    };
  }

  describe("Authentication & Authorization Enforcement", () => {
    it("rejects operator with no active staff record", async () => {
      const operator: InhouseBookingOperator = {
        authUserId: "user-1",
        staff: null,
        staffRole: null,
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList({}, makeContext(operator));
      expect(result).toEqual({
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No active staff profile found for this authenticated user.",
      });
    });

    it("rejects operator with non-CRM role (e.g. therapist)", async () => {
      const operator: InhouseBookingOperator = {
        authUserId: "user-therapist",
        staff: {
          id: STAFF_1,
          branch_id: BRANCH_AAA,
          system_role: "therapist",
        },
        staffRole: "therapist",
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList({}, makeContext(operator));
      expect(result).toEqual({
        ok: false,
        code: "CRM_PERMISSION_DENIED",
        message: "You do not have permission to access the CRM customer workspace.",
      });
    });

    it("rejects non-owner staff not assigned to a branch", async () => {
      const operator: InhouseBookingOperator = {
        authUserId: "user-manager",
        staff: {
          id: STAFF_1,
          branch_id: null,
          system_role: "manager",
        },
        staffRole: "manager",
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList({}, makeContext(operator));
      expect(result).toEqual({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You are not assigned to a branch.",
      });
    });

    it("rejects non-owner staff requesting a different branch (cross-branch denied)", async () => {
      const operator: InhouseBookingOperator = {
        authUserId: "user-receptionist",
        staff: {
          id: STAFF_1,
          branch_id: BRANCH_AAA,
          system_role: "crm",
        },
        staffRole: "crm",
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList(
        { branchId: BRANCH_BBB },
        makeContext(operator)
      );
      expect(result).toEqual({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only access customers for your assigned branch.",
      });
    });
  });

  describe("Owner Branch Context & Validation", () => {
    it("rejects owner when no branchId is supplied and owner has no assigned branch", async () => {
      const ownerOperator: InhouseBookingOperator = {
        authUserId: "owner-user",
        staff: {
          id: STAFF_1,
          branch_id: null,
          system_role: "owner",
        },
        staffRole: "owner",
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList({}, makeContext(ownerOperator));
      expect(result).toEqual({
        ok: false,
        code: "BRANCH_REQUIRED",
        message: "A branchId must be specified for this workspace.",
      });
    });

    it("rejects non-existent branch for owner with BRANCH_NOT_FOUND", async () => {
      const ownerOperator: InhouseBookingOperator = {
        authUserId: "owner-user",
        staff: {
          id: STAFF_1,
          branch_id: null,
          system_role: "owner",
        },
        staffRole: "owner",
        isDevBypass: false,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList(
        { branchId: BRANCH_AAA },
        makeContext(ownerOperator)
      );
      expect(result).toEqual({
        ok: false,
        code: "BRANCH_NOT_FOUND",
        message: "Selected branch was not found.",
      });
    });

    it("fails closed with SERVER_DATABASE_ERROR on branch database error", async () => {
      const ownerOperator: InhouseBookingOperator = {
        authUserId: "owner-user",
        staff: {
          id: STAFF_1,
          branch_id: null,
          system_role: "owner",
        },
        staffRole: "owner",
        isDevBypass: false,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: "DB timeout" } }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList(
        { branchId: BRANCH_AAA },
        makeContext(ownerOperator)
      );
      expect(result).toEqual({
        ok: false,
        code: "SERVER_DATABASE_ERROR",
        message: "Failed to verify branch.",
      });
    });

    it("rejects invalid branchId format", async () => {
      const ownerOperator: InhouseBookingOperator = {
        authUserId: "owner-user",
        staff: {
          id: STAFF_1,
          branch_id: null,
          system_role: "owner",
        },
        staffRole: "owner",
        isDevBypass: false,
      };

      const result = await executeDesktopCustomerList(
        { branchId: "not-a-uuid" },
        makeContext(ownerOperator)
      );
      expect(result).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid branchId format.",
      });
    });
  });

  describe("Strict Parameter Validation", () => {
    const validOperator: InhouseBookingOperator = {
      authUserId: "user-manager",
      staff: {
        id: STAFF_1,
        branch_id: BRANCH_AAA,
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    };

    it("rejects invalid tab values with VALIDATION_ERROR", async () => {
      const result = await executeDesktopCustomerList(
        { tab: "garbage" },
        makeContext(validOperator)
      );
      expect(result).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid tab parameter. Allowed values: all, repeat, lapsed, followup.",
      });
    });

    it("rejects invalid page parameters (0, -1, 1.5, abc)", async () => {
      for (const invalidPage of [0, -1, 1.5, "abc", "0", "-5", "1.5"]) {
        const result = await executeDesktopCustomerList(
          { page: invalidPage },
          makeContext(validOperator)
        );
        expect(result).toEqual({
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid page parameter. Must be an integer greater than or equal to 1.",
        });
      }
    });

    it("rejects invalid pageSize parameters (0, 101, 1.5, abc)", async () => {
      for (const invalidPageSize of [0, 101, 1.5, "abc", "0", "101", "2.5"]) {
        const result = await executeDesktopCustomerList(
          { pageSize: invalidPageSize },
          makeContext(validOperator)
        );
        expect(result).toEqual({
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Invalid pageSize parameter. Must be an integer between 1 and 100.",
        });
      }
    });

    it("rejects search queries longer than 100 characters", async () => {
      const longQuery = "a".repeat(101);
      const result = await executeDesktopCustomerList({ q: longQuery }, makeContext(validOperator));
      expect(result).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Search query exceeds maximum length of 100 characters.",
      });
    });
  });

  describe("Database Error Truthfulness & Fail-Closed Behavior", () => {
    const validOperator: InhouseBookingOperator = {
      authUserId: "user-manager",
      staff: {
        id: STAFF_1,
        branch_id: BRANCH_AAA,
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    };

    it("fails closed with SERVER_DATABASE_ERROR when bookings membership query fails", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: "Bookings DB error" } }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList({}, makeContext(validOperator));
      expect(result).toEqual({
        ok: false,
        code: "SERVER_DATABASE_ERROR",
        message: "Failed to retrieve branch customer membership.",
      });
    });

    it("fails closed with SERVER_DATABASE_ERROR when KPI queries fail", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  data: [{ customer_id: CUSTOMER_1 }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi
              .fn()
              .mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts?.head === true) {
                  return {
                    in: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lt: vi
                          .fn()
                          .mockResolvedValue({ count: null, error: { message: "KPI DB Error" } }),
                        count: null,
                        error: { message: "KPI DB Error" },
                        then: (cb: (val: unknown) => unknown) =>
                          Promise.resolve({ count: null, error: { message: "KPI DB Error" } }).then(
                            cb
                          ),
                      }),
                    }),
                  };
                }
                return {
                  in: vi.fn().mockReturnValue({
                    data: null,
                    error: { message: "KPI DB Error" },
                    then: (cb: (val: unknown) => unknown) =>
                      Promise.resolve({ data: null, error: { message: "KPI DB Error" } }).then(cb),
                  }),
                };
              }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList({}, makeContext(validOperator));
      expect(result).toEqual({
        ok: false,
        code: "SERVER_DATABASE_ERROR",
        message: "Failed to calculate customer metrics.",
      });
    });
  });

  describe("List Query & Segments & Data Minimization", () => {
    const validOperator: InhouseBookingOperator = {
      authUserId: "user-manager",
      staff: {
        id: STAFF_1,
        branch_id: BRANCH_AAA,
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    };

    it("returns empty result when branch has legitimately zero customer bookings", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList({}, makeContext(validOperator));
      expect(result).toEqual({
        ok: true,
        tab: "all",
        data: [],
        waitlist: [],
        pagination: {
          page: 1,
          pageSize: 25,
          totalCount: 0,
          totalPages: 1,
        },
        kpis: {
          totalCustomers: 0,
          repeatClients: 0,
          lapsedClients: 0,
          newThisMonth: 0,
          totalVisits: 0,
        },
      });
    });

    it("returns populated customer list with operational fields only (no sensitive notes, no finance)", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({
                  data: [{ customer_id: CUSTOMER_1 }, { customer_id: CUSTOMER_2 }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi
              .fn()
              .mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts?.head === true) {
                  return {
                    in: vi.fn().mockReturnValue({
                      gte: vi.fn().mockImplementation(() => ({
                        lt: vi.fn().mockResolvedValue({ count: 1, error: null }),
                        count: 1,
                        error: null,
                        then: (cb: (val: { count: number; error: null }) => unknown) =>
                          Promise.resolve({ count: 1, error: null }).then(cb),
                      })),
                    }),
                  };
                }

                return {
                  in: vi.fn().mockImplementation((field: string) => {
                    if (field === "id") {
                      return {
                        order: vi.fn().mockReturnValue({
                          range: vi.fn().mockResolvedValue({
                            data: [
                              {
                                id: CUSTOMER_1,
                                full_name: "Juan Dela Cruz",
                                phone: "09171112233",
                                email: "juan@example.com",
                                total_bookings: 3,
                                first_booking_date: "2026-01-01",
                                last_booking_date: "2026-09-01",
                                preferred_staff_id: STAFF_1,
                                staff: { id: STAFF_1, full_name: "Maria Santos", nickname: "May" },
                              },
                            ],
                            count: 1,
                            error: null,
                          }),
                        }),
                        data: [{ total_bookings: 3 }, { total_bookings: 2 }],
                        then: (
                          cb: (val: { data: { total_bookings: number }[]; error: null }) => unknown
                        ) =>
                          Promise.resolve({
                            data: [{ total_bookings: 3 }, { total_bookings: 2 }],
                            error: null,
                          }).then(cb),
                      };
                    }
                    return {};
                  }),
                };
              }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList(
        { tab: "all", page: 1, pageSize: 25 },
        makeContext(validOperator)
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.tab).toBe("all");
      expect(result.data).toHaveLength(1);
      const customer = result.data[0];
      expect(customer).toEqual({
        id: CUSTOMER_1,
        fullName: "Juan Dela Cruz",
        phone: "09171112233",
        email: "juan@example.com",
        totalBookings: 3,
        firstBookingDate: "2026-01-01",
        lastBookingDate: "2026-09-01",
        preferredStaffId: STAFF_1,
        preferredStaffName: "May",
      });

      // Data minimization verification
      expect(customer).not.toHaveProperty("notes");
      expect(customer).not.toHaveProperty("healthNotes");
      expect(customer).not.toHaveProperty("pressurePreference");
      expect(customer).not.toHaveProperty("birthday");
      expect(customer).not.toHaveProperty("pricePaid");
      expect(customer).not.toHaveProperty("totalRevenue");
      expect(customer).not.toHaveProperty("averageSpend");
      expect(customer).not.toHaveProperty("paymentMethod");
      expect(customer).not.toHaveProperty("paymentStatus");
    });

    it("queries waitlist_requests when tab=followup without mutating records", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === "waitlist_requests") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "waitlist-uuid-1",
                          customer_name: "Followup Guest",
                          customer_phone: "09179998877",
                          preferred_date: "2026-09-10",
                          preferred_time: "14:00:00",
                          visit_type: "in_spa",
                          status: "waiting",
                          notes: "Prefers female therapist",
                          created_at: "2026-09-05T10:00:00Z",
                          services: { id: "service-1", name: "Deep Tissue Massage" },
                        },
                      ],
                      count: 1,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerList(
        { tab: "followup" },
        makeContext(validOperator)
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.tab).toBe("followup");
      expect(result.data).toEqual([]);
      expect(result.waitlist).toHaveLength(1);
      expect(result.waitlist[0]).toEqual({
        id: "waitlist-uuid-1",
        customerName: "Followup Guest",
        customerPhone: "09179998877",
        serviceId: "service-1",
        serviceName: "Deep Tissue Massage",
        visitType: "in_spa",
        preferredDate: "2026-09-10",
        preferredTime: "14:00:00",
        status: "waiting",
        notes: "Prefers female therapist",
        createdAt: "2026-09-05T10:00:00Z",
      });
    });
  });

  describe("Customer Detail Query & Branch-Filtered History", () => {
    const validOperator: InhouseBookingOperator = {
      authUserId: "user-manager",
      staff: {
        id: STAFF_1,
        branch_id: BRANCH_AAA,
        system_role: "manager",
      },
      staffRole: "manager",
      isDevBypass: false,
    };

    it("rejects invalid customerId UUID format", async () => {
      const result = await executeDesktopCustomerDetail(
        "invalid-id",
        {},
        makeContext(validOperator)
      );
      expect(result).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid customerId format.",
      });
    });

    it("returns 404 when customer has no bookings at effective branch", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerDetail(CUSTOMER_1, {}, makeContext(validOperator));
      expect(result).toEqual({
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found or has no bookings at this branch.",
      });
    });

    it("fails closed with SERVER_DATABASE_ERROR when membership check fails in DB", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerDetail(CUSTOMER_1, {}, makeContext(validOperator));
      expect(result).toEqual({
        ok: false,
        code: "SERVER_DATABASE_ERROR",
        message: "Failed to verify customer membership.",
      });
    });

    it("returns full profile and branch-filtered history for authorized customer", async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "branches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: BRANCH_AAA }, error: null }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === "id") {
                // Membership check
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      limit: vi
                        .fn()
                        .mockResolvedValue({ data: [{ id: "booking-1" }], error: null }),
                    }),
                  }),
                };
              }
              // History query
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "booking-1",
                              booking_date: "2026-09-01",
                              start_time: "10:00:00",
                              status: "completed",
                              type: "in_spa",
                              services: { id: "srv-1", name: "Swedish Massage" },
                              staff: { id: STAFF_1, full_name: "Maria Santos", nickname: "May" },
                              branches: { id: BRANCH_AAA, name: "CradleHub BGC" },
                            },
                          ],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: CUSTOMER_1,
                    full_name: "Juan Dela Cruz",
                    phone: "09171112233",
                    email: "juan@example.com",
                    first_booking_date: "2026-01-01",
                    last_booking_date: "2026-09-01",
                    total_bookings: 5,
                    notes: "VIP Client. Prefers quiet room.",
                    preferred_staff_id: STAFF_1,
                    preferred_visit_type: "in_spa",
                    pressure_preference: "medium",
                    health_notes: "Lower back tension",
                    birthday: "1990-05-15",
                    loyalty_tier: "gold",
                    staff: { id: STAFF_1, full_name: "Maria Santos", nickname: "May" },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await executeDesktopCustomerDetail(CUSTOMER_1, {}, makeContext(validOperator));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.customer).toEqual({
        id: CUSTOMER_1,
        fullName: "Juan Dela Cruz",
        phone: "09171112233",
        email: "juan@example.com",
        firstBookingDate: "2026-01-01",
        lastBookingDate: "2026-09-01",
        totalBookings: 5,
        notes: "VIP Client. Prefers quiet room.",
        preferredStaffId: STAFF_1,
        preferredStaffName: "May",
        preferredVisitType: "in_spa",
        pressurePreference: "medium",
        healthNotes: "Lower back tension",
        birthday: "1990-05-15",
        loyaltyTier: "gold",
      });

      expect(result.bookingHistory).toEqual([
        {
          id: "booking-1",
          bookingDate: "2026-09-01",
          startTime: "10:00:00",
          status: "completed",
          type: "in_spa",
          serviceName: "Swedish Massage",
          staffName: "May",
          branchName: "CradleHub BGC",
        },
      ]);

      // Verify zero finance data in history
      const historyItem = result.bookingHistory[0];
      expect(historyItem).not.toHaveProperty("pricePaid");
      expect(historyItem).not.toHaveProperty("amount");
      expect(historyItem).not.toHaveProperty("paymentMethod");
      expect(historyItem).not.toHaveProperty("paymentStatus");
      expect(historyItem).not.toHaveProperty("paymentReference");
    });
  });
});
