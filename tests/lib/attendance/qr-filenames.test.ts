import { describe, expect, it } from "vitest";

import { buildQrFilename } from "@/lib/attendance/qr-filenames";

describe("attendance QR filenames", () => {
  it("builds predictable export filenames", () => {
    expect(
      buildQrFilename({
        qrPoint: { label: "VIP Doorknob / Front", point_type: "resource" },
        format: "door",
        extension: "svg",
      }),
    ).toBe("cradlehub-resource-vip-doorknob-front-door.svg");
  });

  it("uses a fallback slug for empty labels", () => {
    expect(buildQrFilename({ qrPoint: { label: "   ", point_type: "room" }, format: "a4", extension: "png" })).toBe(
      "cradlehub-room-qr-point-a4.png",
    );
  });
});
