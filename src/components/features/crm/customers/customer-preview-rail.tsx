"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CrmPreviewRailShell } from "@/components/features/crm/premium/crm-preview-rail-shell";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import { CrmLoadingShimmer } from "@/components/features/crm/premium/crm-loading-shimmer";
import { CrmMotionSection } from "@/components/features/crm/premium/crm-motion-section";
import { getCustomerProfileAction, updateCustomerAction } from "@/app/(dashboard)/crm/actions";
import { PremiumSuccessToast } from "@/components/shared/motion/premium-success-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeSegment, firstRelation, initials } from "./lib/customer-segments";
import type { CrmStatusVariant } from "@/components/features/crm/premium/crm-status-badge";
import type { Segment } from "./lib/customer-segments";
import type { CustomerListItem } from "./lib/customer-segments";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  DollarSign,
  Heart,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  Star,
  User,
  XIcon,
} from "lucide-react";

interface BookingHistoryItem {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  metadata?: unknown;
  services?: { name?: string } | { name?: string }[] | null;
}

interface CustomerProfileData {
  customer: CustomerListItem & {
    preferred_visit_type?: string | null;
    pressure_preference?: string | null;
    health_notes?: string | null;
    birthday?: string | null;
    loyalty_tier?: string | null;
    created_at?: string;
  };
  bookings: BookingHistoryItem[];
}

interface CustomerPreviewRailProps {
  customer: CustomerListItem | null;
  onClose: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
}

const SEGMENT_TO_VARIANT: Record<NonNullable<Segment>, CrmStatusVariant> = {
  new:    "new",
  repeat: "repeat",
  lapsed: "lapsed",
  vip:    "vip",
};

function readPricePaid(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const maybePrice = (metadata as Record<string, unknown>)["price_paid"];
  if (typeof maybePrice === "number") return maybePrice;
  if (typeof maybePrice === "string") {
    const parsed = Number(maybePrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mostBookedService(bookings: BookingHistoryItem[]): string | null {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const svc = firstRelation(b.services);
    if (svc?.name) {
      counts.set(svc.name, (counts.get(svc.name) ?? 0) + 1);
    }
  }
  let max = 0;
  let name: string | null = null;
  for (const [svcName, count] of counts) {
    if (count > max) {
      max = count;
      name = svcName;
    }
  }
  return name;
}

function nextBookingDate(bookings: BookingHistoryItem[]): string | null {
  const upcoming = bookings
    .filter(
      (b) =>
        b.status !== "completed" &&
        b.status !== "cancelled" &&
        b.status !== "no_show"
    )
    .sort(
      (a, b) =>
        new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime()
    );
  return upcoming[0]?.booking_date ?? null;
}

export function CustomerPreviewRail({
  customer,
  onClose,
  isMobileOpen,
  setIsMobileOpen,
}: CustomerPreviewRailProps) {
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, startSavingNote] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const customerId = customer?.id;

  useEffect(() => {
    if (!customerId) return;
    startLoading(async () => {
      const result = await getCustomerProfileAction(customerId);
      if (
        result &&
        typeof result === "object" &&
        "customer" in result &&
        "bookings" in result
      ) {
        const payload = result as unknown as CustomerProfileData;
        setProfile(payload);
        setNoteText(payload.customer.notes ?? "");
      }
    });
  }, [customerId]);

  // Guard: nothing selected
  if (!customer) return null;

  const segment = computeSegment(customer);
  const statusVariant = segment ? SEGMENT_TO_VARIANT[segment] : null;
  const completedBookings = (profile?.bookings ?? []).filter(
    (b) => b.status === "completed"
  );
  const totalRevenue = completedBookings.reduce(
    (sum, b) => sum + readPricePaid(b.metadata),
    0
  );
  const favoriteService = mostBookedService(profile?.bookings ?? []);
  const nextBooking = nextBookingDate(profile?.bookings ?? []);
  const lastVisit = customer.last_booking_date;

  function handleSaveNote() {
    if (!customer) return;
    startSavingNote(async () => {
      const result = await updateCustomerAction({
        customerId: customer.id,
        notes: noteText.trim(),
      });
      if (result.success) {
        setToastMessage("Note saved.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        toast.error(result.error ?? "Could not save note.");
      }
    });
  }

  const railContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[var(--cs-border-soft)] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-sm font-semibold text-[var(--cs-sand)]">
          {initials(customer.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--cs-text)]">
              {customer.full_name}
            </h3>
            {statusVariant && (
              <CrmStatusBadge variant={statusVariant} size="sm" />
            )}
          </div>
          <div className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
            {customer.phone}
          </div>
        </div>
        {/* Matches AdminDialog / AdminDrawer close button convention */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="hidden text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)] lg:inline-flex"
        >
          <XIcon />
          <span className="sr-only">Close preview</span>
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && !profile ? (
          <CrmLoadingShimmer variant="rail" />
        ) : (
          <>
            {/* Contact info */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                <Phone size={12} />
                <span className="text-[var(--cs-text-secondary)]">
                  {customer.phone}
                </span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                  <Mail size={12} />
                  <span className="text-[var(--cs-text-secondary)]">
                    {customer.email}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                <Calendar size={12} />
                <span className="text-[var(--cs-text-secondary)]">
                  Customer since{" "}
                  {profile?.customer.created_at
                    ? formatDate(profile.customer.created_at)
                    : "—"}
                </span>
              </div>
              {lastVisit && (
                <div className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                  <Clock size={12} />
                  <span className="text-[var(--cs-text-secondary)]">
                    Last visit {formatDate(lastVisit)}
                  </span>
                </div>
              )}
              {profile?.customer.preferred_visit_type && (
                <div className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
                  <MapPin size={12} />
                  <span className="text-[var(--cs-text-secondary)]">
                    Prefers{" "}
                    {profile.customer.preferred_visit_type === "home_service"
                      ? "Home Service"
                      : "In-Spa"}
                  </span>
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <User size={10} />
                  Total Visits
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--cs-text)]">
                  {customer.total_bookings}
                </div>
              </div>
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <DollarSign size={10} />
                  Total Spent
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--cs-text)]">
                  {formatCurrency(totalRevenue)}
                </div>
              </div>
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <Clock size={10} />
                  Last Visit
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--cs-text)]">
                  {lastVisit ? formatDate(lastVisit) : "—"}
                </div>
              </div>
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <Calendar size={10} />
                  Next Booking
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--cs-text)]">
                  {nextBooking ? formatDate(nextBooking) : "—"}
                </div>
              </div>
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <Heart size={10} />
                  Favourite
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--cs-text)]">
                  {favoriteService ?? "—"}
                </div>
              </div>
              <div className="cs-metric p-2.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--cs-text-muted)]">
                  <Star size={10} />
                  Tier
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--cs-text)]">
                  {profile?.customer.loyalty_tier ?? "—"}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-4">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Quick Actions
              </div>
              <div className="flex flex-col gap-1.5">
                <Link
                  href={`/crm/bookings/new?customerId=${customer.id}`}
                  className="cs-btn cs-btn-primary justify-start text-xs"
                >
                  <Calendar size={14} />
                  New Booking
                </Link>
                <Link
                  href={`/crm/${customer.id}`}
                  className="cs-btn cs-btn-secondary justify-start text-xs"
                >
                  <User size={14} />
                  View Full Profile
                </Link>
                <button
                  onClick={() => {
                    const el = document.getElementById("rail-notes");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="cs-btn cs-btn-secondary justify-start text-xs"
                >
                  <NotebookPen size={14} />
                  Add Note
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <CrmMotionSection delay={120} className="mb-4">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Recent Activity
              </div>
              {profile && profile.bookings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--cs-border)] p-3 text-center text-xs text-[var(--cs-text-muted)]">
                  No bookings yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {(profile?.bookings ?? []).slice(0, 5).map((booking) => {
                    const svc = firstRelation(booking.services);
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between rounded-md border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-[var(--cs-text)]">
                            {svc?.name ?? "Booking"}
                          </div>
                          <div className="text-[10.5px] text-[var(--cs-text-muted)]">
                            {formatDate(booking.booking_date)} · {booking.status}
                          </div>
                        </div>
                        {readPricePaid(booking.metadata) > 0 && (
                          <div className="ml-2 shrink-0 text-xs font-medium text-[var(--cs-text)]">
                            {formatCurrency(readPricePaid(booking.metadata))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CrmMotionSection>

            {/* Notes */}
            <div id="rail-notes">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
                Notes
              </div>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this customer…"
                className="min-h-[80px] w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-2.5 text-xs text-[var(--cs-text)] placeholder:text-[var(--cs-text-subtle)] focus:border-[var(--cs-sand)] focus:outline-none focus:ring-2 focus:ring-[var(--cs-sand)]/20"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleSaveNote}
                  disabled={isSavingNote}
                  className="cs-btn cs-btn-primary cs-btn-sm"
                >
                  {isSavingNote ? "Saving…" : "Save Note"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <PremiumSuccessToast
        open={showToast}
        title={toastMessage}
        variant="success"
      />
    </div>
  );

  return (
    <CrmPreviewRailShell
      isOpen
      onClose={onClose}
      isMobileOpen={isMobileOpen}
      onMobileOpenChange={setIsMobileOpen}
    >
      {railContent}
    </CrmPreviewRailShell>
  );
}
