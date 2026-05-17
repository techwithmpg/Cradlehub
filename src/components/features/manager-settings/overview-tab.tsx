"use client";

import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "./settings-section-card";
import { SettingsWarningCard } from "./settings-warning-card";
import { formatTimeRange } from "./settings-format";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import type { SchedulingRules } from "@/lib/scheduling/types";
import type {
  ManagerSettingsMetrics,
  ManagerSettingsTab,
} from "./types";

export function OverviewTab({
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
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewCard
          icon={CalendarClock}
          title="Booking Window"
          buttonLabel="View Booking Rules"
          onClick={() => onSelectTab("booking")}
        >
          <Fact label="In-spa time" value={formatTimeRange(bookingRules.inSpaStartTime, bookingRules.inSpaEndTime)} />
          <Fact
            label="Home service"
            value={
              bookingRules.homeServiceEnabled
                ? formatTimeRange(
                    bookingRules.homeServiceStartTime,
                    bookingRules.homeServiceEndTime
                  )
                : "Disabled"
            }
          />
          <Fact
            label="Booking window"
            value={`${bookingRules.maxAdvanceBookingDays} days ahead`}
          />
          <Fact
            label="Travel buffer"
            value={`${bookingRules.travelBufferMins} minutes`}
          />
        </OverviewCard>

        <OverviewCard
          icon={ListChecks}
          title="Services Offered"
          buttonLabel="Manage Services"
          onClick={() => onSelectTab("services")}
        >
          <Fact label="Active services" value={String(metrics.activeServicesCount)} />
          <Fact label="In-spa eligible" value={String(metrics.inSpaEligibleCount)} />
          <Fact label="Home eligible" value={String(metrics.homeServiceEligibleCount)} />
          <p className="rounded-[var(--cs-r-md)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs leading-5 text-[var(--cs-text-secondary)]">
            {metrics.activeServicesCount > 0
              ? "Your services are ready to book."
              : "No services are currently active."}
          </p>
        </OverviewCard>

        <OverviewCard
          icon={ClipboardCheck}
          title="Scheduling Automation"
          buttonLabel="Edit Scheduling Rules"
          onClick={() => onSelectTab("scheduling")}
        >
          <Fact
            label="Minimum total staff"
            value={String(schedulingRules.min_daily_staff)}
          />
          <Fact
            label="Therapists"
            value={String(schedulingRules.min_daily_therapists)}
          />
          <Fact
            label="CSR / front desk"
            value={String(schedulingRules.min_daily_csr)}
          />
          <Fact label="Drivers" value={String(schedulingRules.min_daily_drivers)} />
          <Fact
            label="Approval"
            value={
              schedulingRules.suggestions_require_manager_approval
                ? "Manager approval required"
                : "Can apply without approval"
            }
          />
        </OverviewCard>

        <OverviewCard
          icon={AlertTriangle}
          title="Attention / Safety"
          buttonLabel="View All Warnings"
          onClick={() => onSelectTab("advanced")}
        >
          {metrics.warnings.length > 0 ? (
            <div className="space-y-2">
              {metrics.warnings.map((warning) => (
                <SettingsWarningCard
                  key={warning.id}
                  warning={warning}
                  onClick={() => onSelectTab("advanced")}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[var(--cs-r-md)] border border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] p-3 text-[var(--cs-success-text)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">No urgent warnings</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  The current branch setup has no derived safety alerts.
                </p>
              </div>
            </div>
          )}
        </OverviewCard>
      </div>

      <SettingsSectionCard
        title="Branch Health"
        description="A quick read on setup completeness using the warnings currently visible on this page."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold text-[var(--cs-text)]">
                {metrics.healthScore}%
              </p>
              <p className="mt-1 text-sm leading-5 text-[var(--cs-text-secondary)]">
                Branch setup is {metrics.healthScore}% complete.{" "}
                {metrics.warnings.length > 0
                  ? "A few items need your attention."
                  : "Everything here looks ready."}
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[var(--cs-border)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]"
            >
              {metrics.warnings.length} warnings
            </Badge>
          </div>

          <progress
            value={metrics.healthScore}
            max={100}
            aria-label="Branch setup completion"
            className="h-2 w-full overflow-hidden rounded-full accent-[var(--cs-sand)]"
          />

          <Button
            type="button"
            className="bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
            onClick={() => onSelectTab("advanced")}
          >
            View All Warnings
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </SettingsSectionCard>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  buttonLabel,
  onClick,
  children,
}: {
  icon: typeof CalendarClock;
  title: string;
  buttonLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <SettingsSectionCard
      title={title}
      action={
        <span className="flex size-9 items-center justify-center rounded-[var(--cs-r-md)] bg-[var(--cs-sand-tint)] text-[var(--cs-sand-dark)]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      }
    >
      <div className="space-y-3">
        <div className="space-y-2">{children}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[var(--cs-border)] text-[var(--cs-sand-dark)] hover:bg-[var(--cs-sand-tint)]"
          onClick={onClick}
        >
          {buttonLabel}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--cs-r-sm)] border border-[var(--cs-border-soft)] px-3 py-2">
      <span className="text-xs font-medium text-[var(--cs-text-muted)]">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-[var(--cs-text)]">
        {value}
      </span>
    </div>
  );
}
