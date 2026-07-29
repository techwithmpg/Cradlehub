import "server-only";

import QRCode from "qrcode";
import { ATTENDANCE_QR_RENDER_OPTIONS } from "@/lib/attendance/qr-render-options";
export {
  buildActivationUrl,
  buildScanUrl,
  getAppBaseUrl,
  maskPublicCode,
} from "@/lib/attendance/qr-url";

export async function renderQrSvg(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    ...ATTENDANCE_QR_RENDER_OPTIONS,
  });
}
