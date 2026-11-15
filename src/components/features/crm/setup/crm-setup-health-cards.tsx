import type { ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  Car,
  ClipboardList,
  Sparkles,
  Users,
} from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

type CardStatus = "ready" | "warning" | "error" | "info";

type HealthCard = {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  status: CardStatus;
};

const STATUS_TO_TONE: Record<CardStatus, CrmCardTone> = {
  ready: "success",
  warning: "warning",
  error: "danger",
  info: "info",
};

function buildCards(d: CrmSetupHealthData): HealthCard[] {
  const staffStatus: CardStatus =
    d.serviceStaffTotal === 0            ? "warning"
    : d.serviceStaffWithSchedule === d.serviceStaffTotal ? "ready"
    : "warning";

  const servicesStatus: CardStatus =
    d.activeServicesTotal === 0          ? "warning"
    : d.servicesWithStaff === d.activeServicesTotal ? "ready"
    : d.servicesWithStaff === 0          ? "error"
    : "warning";

  const resourcesStatus: CardStatus =
    d.activeResourcesTotal > 0 ? "ready" : "warning";

  const rulesStatus: CardStatus = d.hasCustomRules ? "ready" : "info";

  const homeServiceStatus: CardStatus =
    !d.homeServiceEnabled                      ? "info"
    : d.driversTotal > 0                       ? "ready"
    : "error";

  const unassignedStatus: CardStatus =
    d.unassignedTodayCount === 0 ? "ready" : "error";

  return [
    {
      icon: <Users className="size-4" />,
      label: "Staff Schedules",
      value: `${d.serviceStaffWithSchedule}/${d.serviceStaffTotal}`,
      sub: d.serviceStaffTotal === 0
        ? "No service staff at branch"
        : d.serviceStaffWithSchedule === d.serviceStaffTotal
        ? "All service staff have schedules"
        : `${d.serviceStaffTotal - d.serviceStaffWithSchedule} need schedules`,
      status: staffStatus,
    },
    {
      icon: <Sparkles className="size-4" />,
      label: "Service Coverage",
      value: `${d.servicesWithStaff}/${d.activeServicesTotal}`,
      sub: d.activeServicesTotal === 0
        ? "No active services"
        : d.servicesWithStaff === d.activeServicesTotal
        ? "All services have providers"
        : `${d.activeServicesTotal - d.servicesWithStaff} need providers`,
      status: servicesStatus,
    },
    {
      icon: <Building2 className="size-4" />,
      label: "Rooms & Resources",
      value: String(d.activeResourcesTotal),
      sub: d.activeResourcesTotal === 0
        ? "None configured"
        : d.activeResourcesTotal === 1
        ? "1 active resource"
        : `${d.activeResourcesTotal} active resources`,
      status: resourcesStatus,
    },
    {
      icon: <ClipboardList className="size-4" />,
      label: "Booking Rules",
      value: d.hasCustomRules ? "Custom" : "Defaults",
      sub: d.hasCustomRules
        ? "Custom rules are saved"
        : "Using system defaults — optional review",
      status: rulesStatus,
    },
    {
      icon: <Car className="size-4" />,
      label: "Home Service",
      value: d.homeServiceEnabled ? "Enabled" : "Disabled",
      sub: d.homeServiceEnabled
        ? `${d.driversTotal} driver${d.driversTotal !== 1 ? "s" : ""} on file`
        : "Not accepting home-service bookings",
      status: homeServiceStatus,
    },
    {
      icon: <CalendarClock className="size-4" />,
      label: "Today's Assignments",
      value: String(d.unassignedTodayCount),
      sub: d.unassignedTodayCount === 0
        ? "All confirmed bookings assigned"
        : `${d.unassignedTodayCount} need a therapist assigned`,
      status: unassignedStatus,
    },
  ];
}

export function CrmSetupHealthCards({ data }: { data: CrmSetupHealthData }) {
  const cards = buildCards(data);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <CrmStatCard
          key={card.label}
          title={card.label}
          value={card.value}
          subtitle={card.sub}
          icon={card.icon}
          tone={STATUS_TO_TONE[card.status]}
          compact
        />
      ))}
    </div>
  );
}
