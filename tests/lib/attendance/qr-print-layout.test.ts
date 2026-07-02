import { describe, expect, it } from "vitest";

import { buildQrPrintSvg, getQrPrintLayout } from "@/lib/attendance/qr-print-layout";

describe("attendance QR print layouts", () => {
  const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256"/></svg>';

  it("exposes fixed print dimensions for supported formats", () => {
    expect(getQrPrintLayout("a4")).toMatchObject({ width: 794, height: 1123, qrSize: 260 });
    expect(getQrPrintLayout("door")).toMatchObject({ width: 420, height: 594, qrSize: 172 });
  });

  it("builds branded staff attendance signs", () => {
    const svg = buildQrPrintSvg(
      { label: "Cradle Wellness Main Spa Attendance", pointType: "attendance", qrSvg, branchName: "Main Branch" },
      "a4",
    );

    expect(svg).toContain("STAFF ATTENDANCE");
    expect(svg).toContain("Scan when arriving");
    expect(svg).toContain("Scan again when leaving");
    expect(svg).toContain("MAIN BRANCH");
    expect(svg).toContain("data:image/svg+xml");
  });

  it("escapes room labels before embedding them in SVG text", () => {
    const svg = buildQrPrintSvg({ label: "Room <A&B>", pointType: "room", qrSvg, branchName: "Main & Branch" }, "door");

    expect(svg).toContain("ROOM &lt;A&amp;B&gt;");
    expect(svg).toContain("MAIN &amp; BRANCH");
    expect(svg).not.toContain("Room <A&B>");
  });
});
