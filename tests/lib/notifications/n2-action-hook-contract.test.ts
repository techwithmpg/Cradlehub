import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bookingSource = readFileSync("src/lib/bookings/crm-booking-operations.ts", "utf8");
const attendanceSource = readFileSync("src/lib/attendance/queries.ts", "utf8");
const scheduleSource = readFileSync("src/lib/bookings/staff-schedule-exception-signals.ts", "utf8");

describe("N2 post-commit resolution hooks", () => {
  it("wires shared booking cleanup to both atomic and ordinary successful confirmation paths", () => {
    const confirm = bookingSource.slice(bookingSource.indexOf("export async function confirmCrmBooking("));
    expect(confirm).toContain("resolveConfirmedBookingRequestAlerts({");
    expect(confirm).toContain("bookingIds: [booking.id, ...data.changed_ids]");
    expect(confirm).toContain("bookingIds: [booking.id]");
    expect(confirm).toContain("if (error || !data?.ok)");
    expect(confirm).toContain("if (!updatedRows || updatedRows.length === 0)");
  });

  it("Attendance only clears dependent alerts when a branch-scoped open exception was updated", () => {
    const start = attendanceSource.indexOf("export async function resolveAttendanceException(");
    const end = attendanceSource.indexOf("export async function reviewAttendanceException(", start);
    const fn = attendanceSource.slice(start, end);
    expect(fn).toContain('.eq("branch_id", params.ctx.branchId)');
    expect(fn).toContain('.eq("status", "open")');
    expect(fn).toContain("if (!resolvedRows?.length)");
    expect(fn).toContain("resolveClosedAttendanceExceptionAlerts({");
    expect(fn.indexOf("resolveClosedAttendanceExceptionAlerts({")).toBeGreaterThan(fn.indexOf("if (!resolvedRows?.length)"));
  });

  it("does not broadly close unrelated schedule warnings on the same booking", () => {
    expect(scheduleSource).toContain("markNotificationResolved({");
    expect(scheduleSource).toContain("dedupeKey,");
    expect(scheduleSource).not.toContain("resolveNotificationsForEntity(");
  });
});
