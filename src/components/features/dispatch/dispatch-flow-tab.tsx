"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  Navigation,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeServiceDispatchModal } from "./home-service-dispatch-modal";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HS"
  );
}

function statusLabel(status: unknown): string {
  const s = statusText(status);
  if (s === "awaiting_driver") return "Needs Driver";
  if (s === "ready") return "Ready";
  if (s === "scheduled") return "Scheduled";
  if (s === "released_to_driver") return "Released";
  if (s === "in_route") return "En Route";
  if (s === "arrived_at_customer") return "Arrived";
  if (s === "service_started") return "In Service";
  if (s === "completed") return "Completed";
  if (s === "cancelled") return "Cancelled";
  return "Needs Setup";
}

function statusBadge(status: unknown): { variant: BadgeVariant; cls: string } {
  const s = statusText(status);

  if (s === "awaiting_driver") {
    return { variant: "outline", cls: "border-amber-400 bg-amber-50 text-amber-700" };
  }

  if (s === "ready") {
    return { variant: "outline", cls: "border-green-300 bg-green-50 text-green-700" };
  }

  if (s === "scheduled") {
    return { variant: "outline", cls: "border-blue-300 bg-blue-50 text-blue-700" };
  }

  if (s === "released_to_driver") {
    return { variant: "outline", cls: "border-purple-300 bg-purple-50 text-purple-700" };
  }

  if (["in_route", "arrived_at_customer", "service_started"].includes(s)) {
    return { variant: "outline", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }

  if (s === "cancelled") {
    return { variant: "outline", cls: "border-red-300 bg-red-50 text-red-700" };
  }

  return { variant: "outline", cls: "border-amber-300 bg-amber-50 text-amber-700" };
}

function getReadinessBadges(item: RealDispatchItem): string[] {
  const badges: string[] = [];

  if (!item.driverId) badges.push("Driver Needed");
  if (!item.therapistId) badges.push("Therapist Needed");
  if (item.lat === null || item.lng === null) badges.push("GPS Missing");
  if (badges.length === 0 && statusText(item.dispatchStatus) === "ready") badges.push("GPS Ready");
  if (statusText(item.dispatchStatus) === "scheduled") badges.push("Scheduled");
  if (statusText(item.dispatchStatus) === "released_to_driver") badges.push("Released");

  return badges;
}

function QueueCard({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = statusBadge(item.dispatchStatus);
  const readinessBadges = getReadinessBadges(item);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:border-[#155A33] hover:shadow-md ${
        selected
          ? "border-[#155A33] bg-green-50"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--cs-text-muted)]">{item.number}</p>
          <p className="mt-1 truncate text-base font-bold text-[var(--cs-text)]">
            {item.customerName}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--cs-text-secondary)]">
            {item.serviceName}
          </p>
        </div>

        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface-warm)] text-xs font-bold text-[var(--cs-text-muted)]">
          {getInitials(item.customerName)}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[var(--cs-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Clock size={13} />
          <span>
            {formatTime12h(item.startTime)}
            {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={13} />
          <span className="truncate">
            {item.area ?? item.formattedAddress ?? "Customer GPS saved"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant={badge.variant} className={`text-[0.68rem] ${badge.cls}`}>
          {statusLabel(item.dispatchStatus)}
        </Badge>

        {readinessBadges.slice(0, 3).map((label) => (
          <Badge
            key={label}
            variant="outline"
            className={`text-[0.68rem] ${
              label.includes("Needed") || label.includes("Missing")
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {label}
          </Badge>
        ))}
      </div>

    </button>
  );
}

function Column({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: RealDispatchItem[];
  selectedId: string | null;
  onSelect: (item: RealDispatchItem) => void;
}) {
  return (
    <div className="rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-[var(--cs-text)]">{title}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--cs-text-muted)] shadow-sm">
          {items.length}
        </span>
      </div>

      <div className="min-h-[430px] space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={() => onSelect(item)}
            />
          ))
        ) : (
          <div className="flex min-h-[115px] items-center justify-center rounded-2xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-center text-sm text-[var(--cs-text-muted)]">
            No bookings here yet
          </div>
        )}
      </div>
    </div>
  );
}

function DetailTile({
  icon,
  label,
  value,
  warning,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warning?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className={warning ? "text-amber-600" : "text-[var(--cs-text-muted)]"}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {label}
          </p>
          <p
            className={`mt-1 truncate text-sm font-bold ${
              warning ? "text-amber-700" : "text-[var(--cs-text)]"
            }`}
            title={value}
          >
            {value}
          </p>
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 size={16} className="text-emerald-600" />
      ) : (
        <AlertCircle size={16} className="text-amber-600" />
      )}
      <span className={ok ? "text-[var(--cs-text)]" : "text-amber-700"}>{label}</span>
    </div>
  );
}

function SelectedBookingPanel({
  item,
  onPrepare,
}: {
  item: RealDispatchItem;
  onPrepare: () => void;
}) {
  const badge = statusBadge(item.dispatchStatus);
  const hasGps = item.lat !== null && item.lng !== null;
  const hasDriver = Boolean(item.driverId);
  const hasTherapist = Boolean(item.therapistId);
  const dispatchOk = hasGps && hasDriver && hasTherapist;

  return (
    <aside className="rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-[var(--cs-text-muted)]">{item.number}</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--cs-text)]">{item.customerName}</h2>
          <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">
            {item.serviceName} · {formatTime12h(item.startTime)}
            {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--cs-text-muted)]">
            <MapPin size={13} />
            {item.area ?? item.formattedAddress ?? "Customer GPS saved"}
          </p>
        </div>

        <Badge variant={badge.variant} className={badge.cls}>
          {statusLabel(item.dispatchStatus)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailTile
          icon={<UserRound size={17} />}
          label="Therapist"
          value={item.therapistName ?? "Not assigned"}
          warning={!hasTherapist}
        />
        <DetailTile
          icon={<Car size={17} />}
          label="Driver"
          value={item.driverName ?? "Not assigned"}
          warning={!hasDriver}
          action={
            !hasDriver ? (
              <span className="inline-flex rounded-lg border border-[var(--cs-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--cs-text-secondary)]">
                Assign in dispatch
              </span>
            ) : null
          }
        />
        <DetailTile
          icon={<MapPin size={17} />}
          label="GPS Status"
          value={hasGps ? "Coordinates ready" : "GPS location missing"}
          warning={!hasGps}
        />
        <DetailTile
          icon={<Clock size={17} />}
          label="ETA"
          value={item.etaMinutes ? `${item.etaMinutes} min` : "Will use default ETA"}
        />
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          Dispatch Checklist
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChecklistItem ok={hasDriver} label="Driver assigned" />
          <ChecklistItem ok={hasTherapist} label="Therapist confirmed" />
          <ChecklistItem ok={hasGps} label="GPS location ready" />
          <ChecklistItem ok={dispatchOk} label="Dispatch OK" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-3 text-sm text-[var(--cs-text-secondary)]">
        <span className="font-semibold text-[var(--cs-text)]">CRM can prepare dispatch early.</span>{" "}
        Driver sees it only when released.
      </div>

      <Button
        type="button"
        onClick={onPrepare}
        className="mt-4 h-12 w-full rounded-2xl bg-[#155A33] text-base font-bold text-white hover:bg-[#104728]"
      >
        <Navigation size={18} />
        Prepare Dispatch
      </Button>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 text-center">
      <Inbox className="mb-3 text-[var(--cs-text-muted)]" size={34} />
      <h3 className="font-bold text-[var(--cs-text)]">No home-service bookings</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--cs-text-muted)]">
        Home-service bookings for this date will appear here for dispatch preparation.
      </p>
    </div>
  );
}

export function DispatchFlowTab({
  data,
}: {
  data: DispatchData;
  role: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(data.items[0]?.id ?? null);
  const [modalItem, setModalItem] = useState<RealDispatchItem | null>(null);

  const groups = useMemo(() => {
    const needsSetup = data.items.filter((item) => {
      const s = statusText(item.dispatchStatus);
      return (
        s === "awaiting_driver" ||
        !item.driverId ||
        !item.therapistId ||
        item.lat === null ||
        item.lng === null
      );
    });

    const ready = data.items.filter((item) => {
      const s = statusText(item.dispatchStatus);
      return (
        s === "ready" &&
        item.driverId &&
        item.therapistId &&
        item.lat !== null &&
        item.lng !== null
      );
    });

    const scheduled = data.items.filter((item) => statusText(item.dispatchStatus) === "scheduled");

    const released = data.items.filter((item) =>
      ["released_to_driver", "in_route", "arrived_at_customer", "service_started"].includes(
        statusText(item.dispatchStatus)
      )
    );

    return { needsSetup, ready, scheduled, released };
  }, [data.items]);

  const selected =
    data.items.find((item) => item.id === selectedId) ??
    data.items[0] ??
    null;

  if (data.items.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <section className="rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--cs-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--cs-text)]">Dispatch Queue</h2>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Drag-and-drop style workflow for driver, therapist, GPS, and timed release.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {data.items.length} home-service booking{data.items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.95fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Column
              title="Needs Setup"
              items={groups.needsSetup}
              selectedId={selected?.id ?? null}
              onSelect={(item) => setSelectedId(item.id)}
            />
            <Column
              title="Ready"
              items={groups.ready}
              selectedId={selected?.id ?? null}
              onSelect={(item) => setSelectedId(item.id)}
            />
            <Column
              title="Scheduled"
              items={groups.scheduled}
              selectedId={selected?.id ?? null}
              onSelect={(item) => setSelectedId(item.id)}
            />
            <Column
              title="Released"
              items={groups.released}
              selectedId={selected?.id ?? null}
              onSelect={(item) => setSelectedId(item.id)}
            />
          </div>

          {selected ? (
            <SelectedBookingPanel
              item={selected}
              onPrepare={() => setModalItem(selected)}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>

      <HomeServiceDispatchModal
        open={Boolean(modalItem)}
        item={modalItem}
        onOpenChange={(open) => {
          if (!open) setModalItem(null);
        }}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
