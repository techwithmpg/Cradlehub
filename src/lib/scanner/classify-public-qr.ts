import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicQrType = "attendance" | "room" | "resource";

/** QR text is an opaque route token. Only the active database row determines its type. */
export async function classifyPublicQr(publicCode: string): Promise<PublicQrType | null> {
  if (!publicCode) return null;
  try {
    const { data, error } = await createAdminClient()
      .from("qr_points")
      .select("point_type, is_active")
      .eq("public_code", publicCode)
      .maybeSingle();
    if (error || !data?.is_active) return null;
    return data.point_type === "attendance" ||
      data.point_type === "room" ||
      data.point_type === "resource"
      ? data.point_type
      : null;
  } catch {
    return null;
  }
}
