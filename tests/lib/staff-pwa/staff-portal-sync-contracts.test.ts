import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rlsSql = readFileSync(
  "supabase/migrations/20261122100000_fix_staff_portal_bookings_notifications_rls.sql",
  "utf8"
);
const autoPushSource = readFileSync(
  "src/components/features/notifications/auto-push-subscription-manager.tsx",
  "utf8"
);
const confirmOpsSource = readFileSync("src/lib/bookings/crm-booking-operations.ts", "utf8");
const therapistHomeSource = readFileSync(
  "src/components/features/staff-portal/therapist/therapist-mobile-home.tsx",
  "utf8"
);
const therapistHeaderSource = readFileSync(
  "src/components/features/staff-portal/therapist/therapist-header.tsx",
  "utf8"
);
const utilityHomeSource = readFileSync(
  "src/components/features/staff-pwa/utility/utility-mobile-home.tsx",
  "utf8"
);

describe("Staff Portal RLS, Push, and Live Sync contracts", () => {
  it("restores service_staff and service_head RLS on bookings, workspace_notifications, and customers", () => {
    expect(rlsSql).toContain('CREATE POLICY "bookings_branch_staff_read" ON public.bookings');
    expect(rlsSql).toContain("'service_staff'::text");
    expect(rlsSql).toContain("'service_head'::text");
    expect(rlsSql).toContain('CREATE POLICY "notif_Select_unified" ON public.workspace_notifications');
    expect(rlsSql).toContain('CREATE POLICY "notif_Update_unified" ON public.workspace_notifications');
    expect(rlsSql).toContain('CREATE POLICY "customers_select_unified" ON public.customers');
    expect(rlsSql).toContain("'bookings', 'workspace_notifications', 'workflow_tasks'");
  });

  it("uses NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY in AutoPushSubscriptionManager", () => {
    expect(autoPushSource).toContain("process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
  });

  it("notifies assigned therapist/staff on both CRM booking confirmation paths", () => {
    const confirmSection = confirmOpsSource.slice(
      confirmOpsSource.indexOf("export async function confirmCrmBooking(")
    );
    const occurrences = confirmSection.match(/notifyConfirmedAssignedStaff\(/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes live bell notifications and direct BookingProgressActions on Staff PWA home", () => {
    expect(therapistHeaderSource).toContain("StaffNoticesBellLink");
    expect(utilityHomeSource).toContain("StaffNoticesBellLink");
    expect(therapistHomeSource).toContain("<BookingProgressActions booking={booking} />");
    expect(therapistHomeSource).not.toContain("{active ? (\n        <div className=\"mt-3 border-t border-[#EEE9E2] pt-3\">\n          <BookingProgressActions");
  });
});
