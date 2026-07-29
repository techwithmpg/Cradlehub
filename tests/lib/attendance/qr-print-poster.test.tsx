import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QrPrintDocument } from "@/components/features/attendance/qr-codes/qr-print-poster";
import { getCradleQrPrintCss } from "@/components/features/attendance/qr-codes/qr-print-styles";
import { getActiveRoomQrPoints } from "@/lib/attendance/qr-print-selection";
import type { AttendanceQrPoint } from "@/lib/attendance/types";

const REAL_QR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" data-real-qr="production-value"><rect width="280" height="280" fill="#FFFFFF"/><path fill="#000000" d="M0 0h20v20H0z"/></svg>';

function qrPoint(overrides: Partial<AttendanceQrPoint>): AttendanceQrPoint {
  return {
    id: "qr-attendance",
    branch_id: "branch-main",
    point_type: "attendance",
    resource_id: null,
    public_code: "real-public-code",
    label: "Main Spa Attendance",
    description: null,
    is_active: true,
    requires_registered_device: true,
    scan_behavior: "auto",
    created_at: "2026-07-29T00:00:00.000Z",
    updated_at: "2026-07-29T00:00:00.000Z",
    resource_name: null,
    resource_capacity: null,
    resource_type: null,
    resource_is_active: null,
    scan_url: "https://cradle.example/scan/real-public-code",
    svg: REAL_QR_SVG,
    ...overrides,
  };
}

describe("Cradle QR poster primitives", () => {
  it("renders the Attendance title, dynamic branch, instructions, and unchanged generated QR SVG", () => {
    const html = renderToStaticMarkup(
      <QrPrintDocument points={[qrPoint({})]} branchName="Cradle Wellness Main Spa" format="a4" />
    );

    expect(html).toContain("STAFF ATTENDANCE");
    expect(html).toContain("CRADLE WELLNESS MAIN SPA");
    expect(html).toContain("Scan when arriving");
    expect(html).toContain("Scan again when leaving");
    expect(html).toContain(encodeURIComponent(REAL_QR_SVG));
  });

  it("renders a room name, capacity, operational state, and room-only instructions", () => {
    const room = qrPoint({
      id: "qr-room-1",
      point_type: "room",
      resource_id: "room-1",
      label: "Room 01",
      scan_behavior: "start_session",
      resource_name: "Couple Room",
      resource_capacity: 2,
      resource_type: "room",
      resource_is_active: true,
    });
    const html = renderToStaticMarkup(
      <QrPrintDocument points={[room]} branchName="Cradle Wellness SM Branch" format="a4" />
    );

    expect(html).toContain("COUPLE ROOM");
    expect(html).toContain("SERVICE SESSION");
    expect(html).toContain("Capacity 2");
    expect(html).toContain("ACTIVE");
    expect(html).toContain("Confirm the correct customer and service.");
    expect(html).toContain("This QR does not clock staff in or out.");
    expect(html).not.toContain("Scan again when leaving");
  });

  it("renders exactly one poster element per batch item", () => {
    const rooms = [1, 2, 3].map((index) =>
      qrPoint({
        id: `qr-room-${index}`,
        point_type: "room",
        resource_id: `room-${index}`,
        resource_name: `Room ${index}`,
        resource_capacity: 1,
        resource_type: "room",
        resource_is_active: true,
      })
    );
    const html = renderToStaticMarkup(
      <QrPrintDocument points={rooms} branchName="Main Spa" format="a4" />
    );

    expect(html.match(/class="cradle-print-page"/g)).toHaveLength(3);
  });

  it("uses an A4 page contract, suppresses printed controls, and cancels the final page break", () => {
    const css = getCradleQrPrintCss("a4");

    expect(css).toContain("@page{size:210mm 297mm;margin:0}");
    expect(css).toContain("width:210mm;height:297mm;min-height:297mm");
    expect(css).toContain("break-before:auto;break-after:auto;break-inside:avoid-page");
    expect(css).toContain("page-break-before:auto;page-break-after:auto;page-break-inside:avoid");
    expect(css).toContain(
      ".cradle-print-page+.cradle-print-page{break-before:page;page-break-before:always}"
    );
    expect(css).not.toContain(".cradle-print-page:last-child");
    expect(css).toContain(".cradle-print-controls,[data-print-control]{display:none!important}");
    expect(css).not.toContain("last-page");
  });
});

describe("active room print selection", () => {
  it("selects only active room resources for the current branch data and orders them naturally", () => {
    const points = [
      qrPoint({ id: "attendance", point_type: "attendance" }),
      qrPoint({
        id: "room-10",
        point_type: "room",
        resource_id: "r10",
        resource_name: "Room 10",
        resource_type: "room",
        resource_is_active: true,
      }),
      qrPoint({
        id: "room-2",
        point_type: "room",
        resource_id: "r2",
        resource_name: "Room 2",
        resource_type: "room",
        resource_is_active: true,
      }),
      qrPoint({
        id: "qr-inactive",
        point_type: "room",
        resource_id: "r3",
        resource_name: "Room 3",
        resource_type: "room",
        resource_is_active: true,
        is_active: false,
      }),
      qrPoint({
        id: "resource-archived",
        point_type: "room",
        resource_id: "r4",
        resource_name: "Room 4",
        resource_type: "room",
        resource_is_active: false,
      }),
      qrPoint({
        id: "equipment",
        point_type: "room",
        resource_id: "eq1",
        resource_name: "Laser",
        resource_type: "equipment",
        resource_is_active: true,
      }),
    ];

    expect(getActiveRoomQrPoints(points).map((point) => point.id)).toEqual(["room-2", "room-10"]);
  });
});
