import { beforeEach, describe, expect, it, vi } from "vitest";

const { toString } = vi.hoisted(() => ({
  toString: vi.fn(async () => "<svg data-rendered-qr />"),
}));

vi.mock("server-only", () => ({}));
vi.mock("qrcode", () => ({ default: { toString } }));

import { renderQrSvg } from "@/lib/attendance/qr-code";

describe("Attendance QR rendering", () => {
  beforeEach(() => toString.mockClear());

  it("passes the real scan URL through unchanged and renders pure black on white", async () => {
    const realScanUrl = "https://cradlewellnessliving.com/scan/production-token-123";

    await expect(renderQrSvg(realScanUrl)).resolves.toBe("<svg data-rendered-qr />");
    expect(toString).toHaveBeenCalledWith(realScanUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  });
});
