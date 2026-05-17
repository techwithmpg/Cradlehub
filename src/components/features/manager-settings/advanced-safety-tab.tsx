"use client";

import {
  AlertTriangle,
  CalendarClock,
  Car,
  ClipboardCheck,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import type { SchedulingRules } from "@/lib/scheduling/types";
import { SettingsSectionCard } from "./settings-section-card";
import { SettingsWarningCard } from "./settings-warning-card";
import { formatTimeRange } from "./settings-format";
import type {
  ManagerSettingsMetrics,
  ManagerSettingsTab,
} from "./types";

export function AdvancedSafetyTab({
  bookingRules,
  schedulingRules,
  metrics,
  onSelectTab,
}: {
  bookingRules: BranchBookingRules;
  schedulingRules: SchedulingRules;
  metrics: ManagerSettingsMetrics;
  onSelectTab: (tab: ManagerSettingsTab) => void;
}) {
  const homeSafety =
    !bookingRules.homeServiceEnabled ||
    (bookingRules.homeServiceDriverCapacity > 0 &&
      metrics.homeServiceEligibleCount > 0)
      ? "Good"
      : bookingRules.homeServiceDriverCapacity === 0
        ? "Critical"
        : "Warning";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsSectionCard
          title="Home-Service Safety"
          description="Operational readiness for home-service bookings and dispatch capacity."
          action={<StatusBadge status={homeSafety} />}
        >
          <div className="space-y-3">
            <ReadOnlyRow
              icon={Car}
              label="Home service"
              value={bookingRules.homeServiceEnabled ? "Enabled" : "Disabled"}
            />
            <ReadOnlyRow
              icon={Car}
              label="Driver capacity"
              value={String(bookingRules.homeServiceDriverCapacity)}
            />
            <ReadOnlyRow
              icon={Car}
              label="Home-service services"
              value={String(metrics.homeServiceEligibleCount)}
            />
            {bookingRules.homeServiceEnabled &&
            bookingRules.homeServiceDriverCapacity === 0 ? (
              <WarningBox>
                Driver capacity is 0 while home service is enabled.
              </WarningBox>
            ) : null}
            {bookingRules.homeServiceEnabled &&
            metrics.homeServiceEligibleCount === 0 ? (
              <WarningBox>
                Home service is enabled but no active services support home
                service.
              </WarningBox>
            ) : null}
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Automation Safety"
          description="Read-only view of automation switches that can change scheduling behavior."
          action={<ClipboardCheck className="size-5 text-[var(--cs-sand-dark)]" />}
        >
          <div className="space-y-3">
            <ReadOnlyRow
              icon={ShieldAlert}
              label="Manager approval required"
              value={
                schedulingRules.suggestions_require_manager_approval
                  ? "Yes"
                  : "No"
              }
            />
            <ReadOnlyRow
              icon={ClipboardCheck}
              label="Auto-generate break blocks"
              value={schedulingRules.auto_generate_breaks ? "Yes" : "No"}
            />
            <ReadOnlyRow
              icon={ClipboardCheck}
              label="Auto-generate travel buffers"
              value={
                schedulingRules.auto_generate_travel_buffers ? "Yes" : "No"
              }
            />
            <ReadOnlyRow
              icon={ClipboardCheck}
              label="Auto-generate room reset buffers"
              value={
                schedulingRules.auto_generate_room_reset_buffers ? "Yes" : "No"
              }
            />
          </div>
        </SettingsSectionCard>
      </div>

      <SettingsSectionCard
        title="Public Booking Impact"
        description="These settings affect what customers can book on the public booking page."
        action={<Eye className="size-5 text-[var(--cs-sand-dark)]" />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyRow
            icon={CalendarClock}
            label="In-spa booking window"
            value={formatTimeRange(
              bookingRules.inSpaStartTime,
              bookingRules.inSpaEndTime
            )}
          />
          <ReadOnlyRow
            icon={CalendarClock}
            label="Home-service booking window"
            value={
              bookingRules.homeServiceEnabled
                ? formatTimeRange(
                    bookingRules.homeServiceStartTime,
                    bookingRules.homeServiceEndTime
                  )
                : "Disabled"
            }
          />
          <ReadOnlyRow
            icon={CalendarClock}
            label="Max advance booking days"
            value={String(bookingRules.maxAdvanceBookingDays)}
          />
          <ReadOnlyRow
            icon={Eye}
            label="Public services"
            value={String(metrics.publicServicesCount)}
          />
          <ReadOnlyRow
            icon={Car}
            label="Home-service eligible services"
            value={String(metrics.homeServiceEligibleCount)}
          />
        </div>

        <div className="mt-4 rounded-[var(--cs-r-lg)] border border-[var(--cs-warning-bg)] bg-[var(--cs-warning-bg)] p-4 text-[var(--cs-warning-text)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-sm leading-6">
              High impact: Changing booking hours, booking windows, public
              services, or home-service eligibility can affect availability on
              the public booking page. Please review carefully before saving.
            </p>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Warnings Needing Attention"
        description="Derived from the settings loaded for this branch. No warnings are stored by this tab."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[var(--cs-border)] text-[var(--cs-sand-dark)] hover:bg-[var(--cs-sand-tint)]"
            onClick={() => onSelectTab("overview")}
          >
            Back to Overview
          </Button>
        }
      >
        {metrics.warnings.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {metrics.warnings.map((warning) => (
              <SettingsWarningCard key={warning.id} warning={warning} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--cs-r-md)] border border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] p-4 text-sm text-[var(--cs-success-text)]">
            No derived warnings need attention right now.
          </div>
        )}
      </SettingsSectionCard>
    </div>
  );
}

function ReadOnlyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Car;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--cs-text-secondary)]">
        <Icon className="size-4 shrink-0 text-[var(--cs-text-muted)]" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-right text-sm font-semibold text-[var(--cs-text)]">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: "Good" | "Warning" | "Critical" }) {
  if (status === "Good") {
    return (
      <Badge className="bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
        Good
      </Badge>
    );
  }

  if (status === "Critical") {
    return <Badge variant="destructive">Critical</Badge>;
  }

  return (
    <Badge className="bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]">
      Warning
    </Badge>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--cs-r-md)] border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] px-3 py-2 text-sm text-[var(--cs-error-text)]">
      {children}
    </div>
  );
}
