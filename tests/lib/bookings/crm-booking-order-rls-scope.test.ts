import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Simulation of Postgres RLS policy evaluation engine for booking_orders and booking_attendees
type AuthContext = {
  role: string | null;
  branch_id: string | null;
};

type BookingOrder = {
  id: string;
  branch_id: string;
};

type BookingAttendee = {
  id: string;
  booking_order_id: string;
};

// Evaluates the RLS policy for public.booking_orders SELECT
function canSelectBookingOrder(
  ctx: AuthContext,
  order: BookingOrder
): boolean {
  if (ctx.role === "owner") return true; // booking_orders_owner_read_all
  if (
    ["manager", "assistant_manager", "store_manager"].includes(ctx.role ?? "") &&
    order.branch_id === ctx.branch_id
  ) {
    return true; // booking_orders_management_read_branch
  }
  if (ctx.role === "crm" && order.branch_id === ctx.branch_id) {
    return true; // booking_orders_crm_read_branch
  }
  return false;
}

// Evaluates the RLS policy for public.booking_attendees SELECT
function canSelectBookingAttendee(
  ctx: AuthContext,
  attendee: BookingAttendee,
  orders: Map<string, BookingOrder>
): boolean {
  if (ctx.role === "owner") return true; // booking_attendees_owner_read_all

  const parentOrder = orders.get(attendee.booking_order_id);
  if (!parentOrder) return false;

  if (
    ["manager", "assistant_manager", "store_manager"].includes(ctx.role ?? "") &&
    parentOrder.branch_id === ctx.branch_id
  ) {
    return true; // booking_attendees_management_read_branch
  }
  if (ctx.role === "crm" && parentOrder.branch_id === ctx.branch_id) {
    return true; // booking_attendees_crm_read_branch
  }
  return false;
}

describe("CRM Booking Orders and Attendees Branch-Scoped RLS Security", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261016224500_scope_crm_booking_order_and_attendee_read_rls.sql"
  );
  const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n").toLowerCase();

  const branchA = "branch-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const branchB = "branch-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const orderA: BookingOrder = { id: "order-a", branch_id: branchA };
  const orderB: BookingOrder = { id: "order-b", branch_id: branchB };

  const attendeeA: BookingAttendee = { id: "att-a", booking_order_id: "order-a" };
  const attendeeB: BookingAttendee = { id: "att-b", booking_order_id: "order-b" };

  const ordersMap = new Map<string, BookingOrder>([
    ["order-a", orderA],
    ["order-b", orderB],
  ]);

  describe("SQL Forward Migration Contract", () => {
    it("drops broad legacy crm read-all policies", () => {
      expect(sql).toContain('drop policy if exists "booking_orders_crm_read_all" on public.booking_orders;');
      expect(sql).toContain('drop policy if exists "booking_attendees_crm_read_all" on public.booking_attendees;');
    });

    it("creates branch-scoped booking_orders read policy for crm", () => {
      expect(sql).toContain('create policy "booking_orders_crm_read_branch"');
      expect(sql).toContain("on public.booking_orders for select");
      expect(sql).toContain("public.get_auth_role() = 'crm'");
      expect(sql).toContain("and branch_id = public.get_auth_branch_id()");
    });

    it("creates branch-scoped booking_attendees read policy for crm via parent order branch", () => {
      expect(sql).toContain('create policy "booking_attendees_crm_read_branch"');
      expect(sql).toContain("on public.booking_attendees for select");
      expect(sql).toContain("public.get_auth_role() = 'crm'");
      expect(sql).toContain("where bo.id = booking_attendees.booking_order_id");
      expect(sql).toContain("and bo.branch_id = public.get_auth_branch_id()");
    });

    it("does not grant direct write policies to CRM", () => {
      expect(sql).not.toContain("for insert");
      expect(sql).not.toContain("for update");
      expect(sql).not.toContain("for delete");
      expect(sql).not.toContain("for all");
    });
  });

  describe("RLS Authorization Boundary Verification", () => {
    const crmBranchA: AuthContext = { role: "crm", branch_id: branchA };
    const managerBranchA: AuthContext = { role: "manager", branch_id: branchA };
    const owner: AuthContext = { role: "owner", branch_id: null };

    it("CRM same-branch booking_order SELECT = allowed", () => {
      expect(canSelectBookingOrder(crmBranchA, orderA)).toBe(true);
    });

    it("CRM other-branch booking_order SELECT = denied", () => {
      expect(canSelectBookingOrder(crmBranchA, orderB)).toBe(false);
    });

    it("CRM same-branch attendee SELECT = allowed", () => {
      expect(canSelectBookingAttendee(crmBranchA, attendeeA, ordersMap)).toBe(true);
    });

    it("CRM other-branch attendee SELECT = denied", () => {
      expect(canSelectBookingAttendee(crmBranchA, attendeeB, ordersMap)).toBe(false);
    });

    it("Owner cross-branch SELECT = allowed for orders and attendees", () => {
      expect(canSelectBookingOrder(owner, orderA)).toBe(true);
      expect(canSelectBookingOrder(owner, orderB)).toBe(true);
      expect(canSelectBookingAttendee(owner, attendeeA, ordersMap)).toBe(true);
      expect(canSelectBookingAttendee(owner, attendeeB, ordersMap)).toBe(true);
    });

    it("Manager branch behavior preserved: own branch allowed, other branch denied", () => {
      expect(canSelectBookingOrder(managerBranchA, orderA)).toBe(true);
      expect(canSelectBookingOrder(managerBranchA, orderB)).toBe(false);
      expect(canSelectBookingAttendee(managerBranchA, attendeeA, ordersMap)).toBe(true);
      expect(canSelectBookingAttendee(managerBranchA, attendeeB, ordersMap)).toBe(false);
    });
  });
});
