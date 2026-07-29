import { describe, expect, it } from "vitest";

import {
  buildQrPrintSvg,
  createQrPosterContent,
  getQrPrintLayout,
} from "@/lib/attendance/qr-print-layout";

describe("attendance QR print layouts", () => {
  const qrSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256"/></svg>';

  it("exposes fixed print dimensions for supported formats", () => {
    expect(getQrPrintLayout("a4")).toMatchObject({ width: 794, height: 1123, qrSize: 260 });
    expect(getQrPrintLayout("door")).toMatchObject({ width: 420, height: 594, qrSize: 172 });
  });

  it("builds branded staff attendance signs", () => {
    const svg = buildQrPrintSvg(
      {
        label: "Cradle Wellness Main Spa Attendance",
        pointType: "attendance",
        qrSvg,
        branchName: "Main Branch",
      },
      "a4"
    );

    expect(svg).toContain("STAFF ATTENDANCE");
    expect(svg).toContain("Scan when arriving");
    expect(svg).toContain("Scan again when leaving");
    expect(svg).toContain("MAIN BRANCH");
    expect(svg).toContain("data:image/svg+xml");
    expect(svg).toContain(encodeURIComponent(qrSvg));
  });

  it("escapes room labels before embedding them in SVG text", () => {
    const svg = buildQrPrintSvg(
      {
        label: "Room <A&B>",
        pointType: "room",
        qrSvg,
        branchName: "Main & Branch",
        resourceCapacity: 2,
      },
      "door"
    );

    expect(svg).toContain("ROOM &lt;A&amp;B&gt;");
    expect(svg).toContain("MAIN &amp; BRANCH");
    expect(svg).not.toContain("Room <A&B>");
  });

  it("keeps Attendance and room behavior explicitly distinct", () => {
    const attendance = createQrPosterContent({
      label: "Attendance",
      pointType: "attendance",
      qrSvg,
      branchName: "Main Spa",
    });
    const room = createQrPosterContent({
      label: "Room 01",
      pointType: "room",
      qrSvg,
      branchName: "Main Spa",
      resourceName: "Couple Room",
      resourceCapacity: 2,
      isActive: true,
    });

    expect(attendance).toMatchObject({
      title: "STAFF ATTENDANCE",
      branchName: "Main Spa",
      capacityLabel: null,
      primaryInstructions: ["Scan when arriving", "Scan again when leaving"],
    });
    expect(attendance.guidance).toContain("This QR does not start a room or service session.");
    expect(room).toMatchObject({
      title: "COUPLE ROOM",
      subtitle: "SERVICE SESSION",
      capacityLabel: "Capacity 2",
      statusLabel: "ACTIVE",
    });
    expect(room.guidance).toContain("Clock in using the Attendance QR first.");
    expect(room.guidance).toContain("Scan this Room QR when the service is ready to begin.");
    expect(room.distinction).toBe("This QR does not clock staff in or out.");
  });
});
