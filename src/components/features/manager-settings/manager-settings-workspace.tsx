"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ManagerSettingsHeader } from "./manager-settings-header";
import { SettingsSummaryCard } from "./settings-summary-card";
import { SettingsTabs } from "./settings-tabs";
import { BookingRulesTab } from "./booking-rules-tab";
import { ServicesOfferedTab } from "./services-offered-tab";
import { SchedulingAutomationTab } from "./scheduling-automation-tab";
import { OverviewTab } from "./overview-tab";
import { AdvancedSafetyTab } from "./advanced-safety-tab";
import { formatTimeRange } from "./settings-format";
import type {
  ActiveBranchService,
  ManagerSettingsMetrics,
  ManagerSettingsTab,
  ManagerSettingsWarning,
  ManagerSettingsWorkspaceProps,
} from "./types";

function isActiveService(service: ManagerSettingsWorkspaceProps["services"][number]): service is ActiveBranchService {
  return service.is_active && service.services !== null;
}

function getServiceVisibility(
  service: ManagerSettingsWorkspaceProps["services"][number]
) {
  return service.visibility ?? service.booking_visibility ?? "public";
}

function buildWarnings({
  bookingRules,
  metrics,
  schedulingRules,
}: Pick<ManagerSettingsWorkspaceProps, "bookingRules" | "schedulingRules"> & {
  metrics: Omit<ManagerSettingsMetrics, "healthScore" | "warnings">;
}): ManagerSettingsWarning[] {
  const warnings: ManagerSettingsWarning[] = [];

  if (
    bookingRules.homeServiceEnabled &&
    bookingRules.homeServiceDriverCapacity === 0
  ) {
    warnings.push({
      id: "driver-capacity-zero",
      title: "Driver capacity is 0",
      description:
        "Home-service dispatch may be blocked because no concurrent trips are allowed.",
      severity: "critical",
    });
  }

  if (
    bookingRules.homeServiceEnabled &&
    metrics.homeServiceEligibleCount === 0
  ) {
    warnings.push({
      id: "no-home-services",
      title: "No home-service services",
      description:
        "Home service is enabled, but none of the active services can be booked for home visits.",
      severity: "warning",
    });
  }

  if (metrics.activeServicesCount === 0) {
    warnings.push({
      id: "no-active-services",
      title: "No active services",
      description:
        "Customers and staff will not have branch services to choose from until services are added.",
      severity: "critical",
    });
  }

  if (!schedulingRules.auto_generate_room_reset_buffers) {
    warnings.push({
      id: "room-reset-off",
      title: "Room reset buffer is off",
      description:
        "The scheduler will not automatically reserve reset time after room-based services.",
      severity: "warning",
    });
  }

  if (schedulingRules.max_working_hours_per_day > 12) {
    warnings.push({
      id: "long-workday-limit",
      title: "Long workday limit",
      description:
        "Staff can be scheduled for more than 12 hours in a day before the automation flags workload risk.",
      severity: "warning",
    });
  }

  return warnings;
}

function buildMetrics({
  bookingRules,
  services,
  schedulingRules,
}: ManagerSettingsWorkspaceProps): ManagerSettingsMetrics {
  const activeServices = services.filter(isActiveService);
  const activeServicesCount = activeServices.length;
  const inSpaEligibleCount = activeServices.filter(
    (service) => service.available_in_spa
  ).length;
  const homeServiceEligibleCount = activeServices.filter(
    (service) => service.available_home_service
  ).length;
  const publicServicesCount = activeServices.filter(
    (service) => getServiceVisibility(service) === "public"
  ).length;

  const coreMetrics = {
    activeServices,
    activeServicesCount,
    inSpaEligibleCount,
    homeServiceEligibleCount,
    publicServicesCount,
  };
  const warnings = buildWarnings({
    bookingRules,
    metrics: coreMetrics,
    schedulingRules,
  });
  const healthScore = Math.max(40, 100 - warnings.length * 15);

  return {
    ...coreMetrics,
    warnings,
    healthScore,
  };
}

export function ManagerSettingsWorkspace(props: ManagerSettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ManagerSettingsTab>("overview");
  const { bookingRules, schedulingRules } = props;
  const metrics = useMemo(() => buildMetrics(props), [props]);
  const warningPreview = metrics.warnings.slice(0, 3);

  return (
    <section className="space-y-6">
      <ManagerSettingsHeader />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsSummaryCard
          icon={CalendarClock}
          title="Booking Window"
          badge={
            <Badge
              variant="outline"
              className={
                bookingRules.homeServiceEnabled
                  ? "border-[var(--cs-success-bg)] bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"
                  : "border-[var(--cs-border)] bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral-text)]"
              }
            >
              {bookingRules.homeServiceEnabled
                ? "Home enabled"
                : "Home disabled"}
            </Badge>
          }
          actionLabel="View Booking Rules"
          onAction={() => setActiveTab("booking")}
        >
          <MetricLine
            label="In-spa"
            value={formatTimeRange(
              bookingRules.inSpaStartTime,
              bookingRules.inSpaEndTime
            )}
          />
          <MetricLine
            label="Home"
            value={
              bookingRules.homeServiceEnabled
                ? formatTimeRange(
                    bookingRules.homeServiceStartTime,
                    bookingRules.homeServiceEndTime
                  )
                : "Not available"
            }
          />
        </SettingsSummaryCard>

        <SettingsSummaryCard
          icon={ListChecks}
          title="Services Offered"
          actionLabel="Manage Services"
          onAction={() => setActiveTab("services")}
        >
          <MetricLine
            label="Active services"
            value={String(metrics.activeServicesCount)}
          />
          <MetricLine
            label="In-spa eligible"
            value={String(metrics.inSpaEligibleCount)}
          />
          <MetricLine
            label="Home eligible"
            value={String(metrics.homeServiceEligibleCount)}
          />
        </SettingsSummaryCard>

        <SettingsSummaryCard
          icon={ClipboardCheck}
          title="Scheduling Automation"
          badge={
            <Badge variant="outline" className="border-[var(--cs-border)]">
              {schedulingRules.suggestions_require_manager_approval
                ? "Required"
                : "Not required"}
            </Badge>
          }
          actionLabel="View Scheduling Rules"
          onAction={() => setActiveTab("scheduling")}
        >
          <MetricLine
            label="Minimum staff"
            value={String(schedulingRules.min_daily_staff)}
          />
          <MetricLine
            label="Therapists"
            value={String(schedulingRules.min_daily_therapists)}
          />
          <MetricLine
            label="Drivers"
            value={String(schedulingRules.min_daily_drivers)}
          />
        </SettingsSummaryCard>

        <SettingsSummaryCard
          icon={ShieldAlert}
          title="Safety & Alerts"
          badge={
            <Badge
              variant={metrics.warnings.length > 0 ? "destructive" : "outline"}
            >
              {metrics.warnings.length}
            </Badge>
          }
          actionLabel="View Details"
          onAction={() => setActiveTab("advanced")}
        >
          {warningPreview.length > 0 ? (
            <ul className="space-y-1.5">
              {warningPreview.map((warning) => (
                <li key={warning.id} className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 shrink-0 text-[var(--cs-warning)]" />
                  <span className="truncate">{warning.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--cs-text-secondary)]">
              No setup warnings found from the current settings.
            </p>
          )}
        </SettingsSummaryCard>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" ? (
        <OverviewTab
          bookingRules={bookingRules}
          schedulingRules={schedulingRules}
          metrics={metrics}
          onSelectTab={setActiveTab}
        />
      ) : null}
      {activeTab === "booking" ? (
        <BookingRulesTab rules={bookingRules} />
      ) : null}
      {activeTab === "services" ? (
        <ServicesOfferedTab
          branchId={props.branchId}
          services={props.services}
          allServices={props.allServices}
        />
      ) : null}
      {activeTab === "scheduling" ? (
        <SchedulingAutomationTab rules={schedulingRules} />
      ) : null}
      {activeTab === "advanced" ? (
        <AdvancedSafetyTab
          bookingRules={bookingRules}
          schedulingRules={schedulingRules}
          metrics={metrics}
          onSelectTab={setActiveTab}
        />
      ) : null}
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--cs-text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--cs-text)]">
        {value}
      </span>
    </div>
  );
}
