"use server";

import { getStaffPwaContext } from "@/lib/staff-pwa/staff-context";
import { getStaffNotices } from "@/lib/staff-pwa/notices-runtime";

export type DriverTripAlert =
  { id: string; title: string; body: string | null; href: string };

/** Read only the current assigned driver's actionable unread notices. */
export async function getDriverTripAlertAction(): Promise<
  { ok: true; alert: DriverTripAlert | null } | { ok: false }
> {
  try {
    const { group } = await getStaffPwaContext();
    if (group !== "driver") return { ok: false };
    const result = await getStaffNotices();
    if (result.error) return { ok: false };
    const candidate = result.items.find((item) =>
      item.status === "unread" &&
      /^\/staff\/driver\/map\?bookingId=[0-9a-f-]{36}$/i.test(item.href)
    );
    return {
      ok: true,
      alert: candidate
        ? { id: candidate.id, title: candidate.title, body: candidate.body, href: candidate.href }
        : null,
    };
  } catch {
    return { ok: false };
  }
}
