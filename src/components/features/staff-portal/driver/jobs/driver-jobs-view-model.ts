import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export type DriverJobDisplayStatus =
  | "upcoming"
  | "on_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type DriverJobViewModel = {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  city?: string | null;
  serviceName?: string | null;
  bookingDate: string;
  scheduledTimeLabel: string;
  scheduledDateLabel?: string | null;
  sortKey: string;
  status: string;
  displayStatus: DriverJobDisplayStatus;
  statusLabel: string;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsHref: string;
  isActive: boolean;
  isToday: boolean;
  isYesterday?: boolean;
};

export type DriverJobsSummary = {
  total: number;
  completed: number;
  inProgress: number;
  upcoming: number;
};

export type DriverJobsDisplayGroup = {
  label: string;
  jobs: DriverJobViewModel[];
};

const STATUS_LABELS: Record<DriverJobDisplayStatus, string> = {
  upcoming: "Upcoming",
  on_route: "On Route",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
  });
}

function getStartedAt(item: RealDispatchItem, status: DriverJobDisplayStatus): string | null {
  if (status === "in_progress") return item.sessionStartedAt ?? item.arrivedAt ?? item.travelStartedAt;
  if (status === "arrived") return item.arrivedAt ?? item.travelStartedAt;
  if (status === "on_route") return item.travelStartedAt;
  return null;
}

export function getDriverJobDisplayStatus(item: RealDispatchItem): DriverJobDisplayStatus {
  const rawStatus = item.bookingStatus || item.bookingProgressStatus || item.dispatchStatus;
  if (rawStatus === "no_show") return "no_show";

  switch (item.dispatchStatus) {
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "service_started":
      return "in_progress";
    case "arrived_at_customer":
      return "arrived";
    case "in_route":
      return "on_route";
    case "awaiting_driver":
    case "ready":
    case "scheduled":
    case "released_to_driver":
      return "upcoming";
  }
}

export function mapBookingToDriverJobViewModel({
  item,
  detailsBasePath,
  todayISO,
}: {
  item: RealDispatchItem;
  detailsBasePath: string;
  todayISO: string;
}): DriverJobViewModel {
  const displayStatus = getDriverJobDisplayStatus(item);
  const startedAt = getStartedAt(item, displayStatus);
  const address = item.formattedAddress ?? item.area ?? "Address pending";
  const yesterdayISO = toDateOnly(addDays(new Date(`${todayISO}T00:00:00`), -1));
  const isToday = item.bookingDate === todayISO;

  return {
    id: item.id,
    customerName: item.customerName,
    customerPhone: null,
    address,
    city: item.area,
    serviceName: item.serviceName,
    bookingDate: item.bookingDate,
    scheduledTimeLabel: formatTime12h(item.startTime),
    scheduledDateLabel: isToday ? null : formatDateLabel(item.bookingDate),
    sortKey: `${item.bookingDate}T${item.startTime}`,
    status: item.bookingProgressStatus || item.bookingStatus || item.dispatchStatus,
    displayStatus,
    statusLabel: STATUS_LABELS[displayStatus],
    startedAt,
    completedAt: item.completedAt,
    detailsHref: `${detailsBasePath}/${item.id}`,
    isActive: ["on_route", "arrived", "in_progress"].includes(displayStatus),
    isToday,
    isYesterday: item.bookingDate === yesterdayISO,
  };
}

export function getDriverJobsSummary(jobs: DriverJobViewModel[]): DriverJobsSummary {
  return {
    total: jobs.length,
    completed: jobs.filter((job) => job.displayStatus === "completed").length,
    inProgress: jobs.filter((job) =>
      ["on_route", "arrived", "in_progress"].includes(job.displayStatus)
    ).length,
    upcoming: jobs.filter((job) => job.displayStatus === "upcoming").length,
  };
}

export function sortDriverJobsByTime(jobs: DriverJobViewModel[]): DriverJobViewModel[] {
  return [...jobs].sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    if (!a.isToday && !b.isToday) {
      const dateCompare = b.bookingDate.localeCompare(a.bookingDate);
      if (dateCompare !== 0) return dateCompare;
    }
    return a.sortKey.localeCompare(b.sortKey);
  });
}

export function groupDriverJobsForDisplay(jobs: DriverJobViewModel[]): DriverJobsDisplayGroup[] {
  const groups = new Map<string, DriverJobViewModel[]>();
  for (const job of jobs) {
    const label = job.isToday
      ? "Today"
      : job.isYesterday
        ? "Yesterday"
        : formatDateLabel(job.bookingDate);
    groups.set(label, [...(groups.get(label) ?? []), job]);
  }

  return Array.from(groups.entries()).map(([label, groupJobs]) => ({
    label,
    jobs: sortDriverJobsByTime(groupJobs),
  }));
}

export function buildDriverJobViewModels({
  items,
  detailsBasePath,
  todayISO,
}: {
  items: RealDispatchItem[];
  detailsBasePath: string;
  todayISO: string;
}): DriverJobViewModel[] {
  return items.map((item) =>
    mapBookingToDriverJobViewModel({ item, detailsBasePath, todayISO })
  );
}
