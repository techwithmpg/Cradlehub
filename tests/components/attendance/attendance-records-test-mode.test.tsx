/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceRecordsTab } from "@/components/features/attendance/records/attendance-records-tab";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => cleanup());

function record(id: string, staffName: string): AttendanceRecord {
  return {
    id,
    branch_id: "branch-1",
    staff_id: `staff-${id}`,
    staff_name: staffName,
    staff_nickname: null,
    staff_type: "therapist",
    system_role: "staff",
    shift_date: "2026-07-29",
    shift_type: "regular",
    scheduled_start_at: "2026-07-29T01:00:00.000Z",
    scheduled_end_at: "2026-07-29T09:00:00.000Z",
    checked_in_at: "2026-07-29T01:00:00.000Z",
    checked_out_at: null,
    status: "checked_in",
    attendance_status: "present",
    exception_state: null,
    worked_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    clock_in_method: "qr",
    clock_out_method: null,
    attendance_expected_end_at: null,
    earliest_normal_clock_out_at: null,
    latest_normal_clock_out_at: null,
    attendance_policy_source: "schedule",
    attendance_policy_snapshot: {},
    provisional_auto_closed_at: null,
    clock_out_confirmation_required: false,
    actual_clock_out_reconciled_at: null,
    source_label: "Main Attendance",
  };
}

describe("Attendance records Test Mode filter", () => {
  it("keeps live records as the default and exposes training rows in a labelled view", () => {
    const data = {
      records: [record("live", "Live Staff")],
      testRecords: [record("test", "Training Staff")],
      staffOptions: [],
      scanEvents: [],
    } as unknown as AttendanceWorkspaceData;

    render(<AttendanceRecordsTab data={data} />);
    expect(screen.getAllByText("Live Staff").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Training Staff")).toHaveLength(0);

    fireEvent.change(screen.getByRole("combobox", { name: "Data" }), {
      target: { value: "test" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "These training records are excluded from live Attendance totals, availability, payroll, and production reports."
    );
    expect(screen.getAllByText("Training Staff").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Live Staff")).toHaveLength(0);
  });
});
