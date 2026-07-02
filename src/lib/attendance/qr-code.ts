import "server-only";

import QRCode from "qrcode";
export { buildActivationUrl, buildScanUrl, getAppBaseUrl, maskPublicCode } from "@/lib/attendance/qr-url";

export async function renderQrSvg(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}
