"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  Car,
  CheckCircle2,
  Clock,
  MapPinned,
  Navigation,
  ExternalLink,
  Send,
  UserRound,  Check,  ChevronDown,  Loader2,  RefreshCw,  Sparkles,





  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDriverRecommendationsAction,
  getTherapistRecommendationsAction,
} from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import {
  assignBookingTherapistAction,
  prepareHomeServiceDispatchAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type HomeServiceDispatchModalProps = {
  open: boolean;
  item: RealDispatchItem | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

const DISPATCH_BUFFER_MINUTES = 10;

function formatCoordinate(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(5);
}

function buildMapEmbedUrl(
  branchLat: number | null,
  branchLng: number | null,
  destinationLat: number | null,
  destinationLng: number | null
): string | null {
  if (destinationLat === null || destinationLng === null) return null;

  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

  if (browserKey && branchLat !== null && branchLng !== null) {
    const origin = `${branchLat},${branchLng}`;
    const destination = `${destinationLat},${destinationLng}`;

    return `https://www.google.com/maps/embed/v1/directions?key=${browserKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`;
  }

  if (branchLat !== null && branchLng !== null) {
    return `https://maps.google.com/maps?f=d&saddr=${branchLat},${branchLng}&daddr=${destinationLat},${destinationLng}&output=embed`;
  }

  return `https://maps.google.com/maps?q=${destinationLat},${destinationLng}&z=15&output=embed`;
}

function buildRouteUrl(
  branchLat: number | null,
  branchLng: number | null,
  destinationLat: number | null,
  destinationLng: number | null
): string | null {
  if (destinationLat === null || destinationLng === null) return null;

  if (branchLat !== null && branchLng !== null) {
    return `https://www.google.com/maps/dir/?api=1&origin=${branchLat},${branchLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}&travelmode=driving`;
}

function MiniGpsRoutePreview({
  branchName,
  branchLat,
  branchLng,
  lat,
  lng,
}: {
  branchName: string | null;
  branchLat: number | null;
  branchLng: number | null;
  lat: number | null;
  lng: number | null;
}) {
  const safeBranchLat = typeof branchLat === "number" && Number.isFinite(branchLat) ? branchLat : null;
  const safeBranchLng = typeof branchLng === "number" && Number.isFinite(branchLng) ? branchLng : null;
  const safeLat = typeof lat === "number" && Number.isFinite(lat) ? lat : null;
  const safeLng = typeof lng === "number" && Number.isFinite(lng) ? lng : null;

  const mapUrl = buildMapEmbedUrl(safeBranchLat, safeBranchLng, safeLat, safeLng);
  const routeUrl = buildRouteUrl(safeBranchLat, safeBranchLng, safeLat, safeLng);
  const hasBranchOrigin = safeBranchLat !== null && safeBranchLng !== null;

  if (!mapUrl) {
    return (
      <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 p-4 text-center">
        <MapPinned className="mb-2 text-red-500" size={32} />
        <p className="text-sm font-bold text-red-700">GPS location missing</p>
        <p className="mt-1 max-w-xs text-xs text-red-600">
          Add customer GPS coordinates before dispatch can be released.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-sm">
      <div className="relative h-[210px] w-full overflow-hidden bg-[#eef3ef]">
        <iframe
          title="Saved GPS location preview"
          src={mapUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-green-200 bg-white/90 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-green-700 shadow-sm backdrop-blur">
          Branch → Customer Route
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-[var(--cs-text-muted)]">
          Route:{" "}
          <span className="font-semibold text-[var(--cs-text)]">
            {hasBranchOrigin ? branchName ?? "Branch" : "Branch origin missing"} → Customer GPS
          </span>
          <span className="ml-2 text-[var(--cs-text-muted)]">
            ({formatCoordinate(safeLat)}, {formatCoordinate(safeLng)})
          </span>
        </div>

        {routeUrl ? (
          <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#155A33] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#104728]"
          >
            Open Branch Route
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function toAppointmentDate(item: RealDispatchItem): Date {
  return new Date(`${item.bookingDate}T${item.startTime}`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReleasePlan(item: RealDispatchItem) {
  const eta = item.etaMinutes ?? 25;
  const appointment = toAppointmentDate(item);
  const releaseAt = addMinutes(appointment, -(eta + DISPATCH_BUFFER_MINUTES));
  const isDueNow = Date.now() >= releaseAt.getTime();

  return {
    eta,
    appointment,
    releaseAt,
    isDueNow,
  };
}

function StepBadge({ number }: { number: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#155A33] text-[0.7rem] font-bold text-white">
      {number}
    </span>
  );
}

function SummaryCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="mt-0.5 text-[var(--cs-text-muted)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          {label}
        </p>
        <p
          className={`truncate text-sm font-semibold ${
            accent ? "text-amber-700" : "text-[var(--cs-text)]"
          }`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function ChecklistRow({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex size-5 items-center justify-center rounded-md ${
          checked ? "bg-[#155A33] text-white" : "bg-red-50 text-red-600"
        }`}
      >
        {checked ? <CheckCircle2 size={13} /> : <X size={13} />}
      </span>
      <span className={checked ? "text-[var(--cs-text)]" : "text-red-700"}>
        {label}
      </span>
    </div>
  );
}


type FetchRecommendationsAction = (input: { bookingId: string }) => Promise<
  | { success: true; data: { therapists: ScoredStaff[]; drivers: ScoredStaff[] } }
  | { success: false; error: string }
>;

function CompactAssignmentPicker({
  kind,
  bookingId,
  currentStaffId,
  currentStaffName,
  fetchRecommendations,
  onSelect,
}: {
  kind: "driver" | "therapist";
  bookingId: string;
  currentStaffId: string | null;
  currentStaffName: string | null;
  fetchRecommendations: FetchRecommendationsAction;
  onSelect: (staffId: string, overrideReason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ScoredStaff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = kind === "driver" ? "Driver" : "Therapist";
  const currentLabel = currentStaffName?.trim() || `No ${label.toLowerCase()} assigned`;

  function loadSuggestions() {
    setError(null);

    startTransition(async () => {
      const result = await fetchRecommendations({ bookingId });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setRows(kind === "driver" ? result.data.drivers : result.data.therapists);
    });
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);

    if (next && rows === null && !isPending) {
      loadSuggestions();
    }
  }

  const availableRows = rows ?? [];
  const best = availableRows.find((row) => row.status !== "unavailable") ?? availableRows[0] ?? null;
  const count = availableRows.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-3 text-left transition hover:border-[#155A33]"
      >
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {label} selector
          </p>
          <p className="mt-1 truncate text-sm font-bold text-[var(--cs-text)]">
            {currentLabel}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--cs-text-muted)]">
            {best
              ? `Best suggestion: ${best.displayName} · ${best.score} score`
              : open
                ? "Loading suggestions..."
                : "Click to view suggestions"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending ? (
            <Loader2 size={16} className="animate-spin text-[var(--cs-text-muted)]" />
          ) : (
            <Sparkles size={16} className="text-[#155A33]" />
          )}
          <ChevronDown
            size={16}
            className={`text-[var(--cs-text-muted)] transition ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--cs-border)] px-3 py-2">
            <div>
              <p className="text-xs font-bold text-[var(--cs-text)]">
                Choose {label.toLowerCase()}
              </p>
              <p className="text-[0.68rem] text-[var(--cs-text-muted)]">
                {count > 0 ? `${count} suggestion${count === 1 ? "" : "s"} available` : "No suggestions loaded"}
              </p>
            </div>

            <button
              type="button"
              onClick={loadSuggestions}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--cs-text-secondary)] hover:border-[#155A33] hover:text-[#155A33]"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <div className="max-h-[280px] overflow-y-auto p-2">
            {availableRows.length === 0 && !isPending ? (
              <div className="rounded-xl border border-dashed border-[var(--cs-border)] px-3 py-6 text-center text-xs text-[var(--cs-text-muted)]">
                No {label.toLowerCase()} suggestions available.
              </div>
            ) : null}

            {availableRows.map((candidate) => {
              const assigned = candidate.staffId === currentStaffId;
              const unavailable = candidate.status === "unavailable";
              const disabled = assigned || unavailable;
              const tags = [...candidate.reasons, ...candidate.warnings].slice(0, 3);

              return (
                <button
                  key={candidate.staffId}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelect(candidate.staffId, "manager_decision");
                    setOpen(false);
                  }}
                  className={`mb-2 flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    assigned
                      ? "border-green-200 bg-green-50"
                      : unavailable
                        ? "border-red-100 bg-red-50/60 opacity-70"
                        : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[#155A33] hover:bg-green-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[var(--cs-text)]">
                        {candidate.displayName}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                          unavailable
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {candidate.status}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                      {candidate.roleLabel}
                      {candidate.tier ? ` · Tier ${candidate.tier}` : ""}
                      {typeof candidate.workloadCount === "number"
                        ? ` · ${candidate.workloadCount} today`
                        : ""}
                    </p>

                    {tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--cs-surface-warm)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--cs-text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--cs-text)]">{candidate.score}</p>
                      <p className="text-[0.6rem] uppercase tracking-wide text-[var(--cs-text-muted)]">
                        Score
                      </p>
                    </div>

                    <span
                      className={`inline-flex min-w-[72px] justify-center rounded-lg px-3 py-1.5 text-xs font-bold ${
                        assigned
                          ? "bg-green-100 text-green-700"
                          : unavailable
                            ? "bg-red-100 text-red-500"
                            : "bg-[#155A33] text-white"
                      }`}
                    >
                      {assigned ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={12} />
                          Set
                        </span>
                      ) : unavailable ? (
                        "Blocked"
                      ) : (
                        "Select"
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function HomeServiceDispatchModal({
  open,
  item,
  onOpenChange,
  onChanged,
}: HomeServiceDispatchModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const releasePlan = useMemo(() => {
    return item ? getReleasePlan(item) : null;
  }, [item]);

  if (!open || !item || !releasePlan) return null;

  const currentItem = item;
  const currentReleasePlan = releasePlan;
  const hasGps = currentItem.lat !== null && currentItem.lng !== null;
  const hasDriver = Boolean(currentItem.driverId);
  const hasTherapist = Boolean(currentItem.therapistId);
  const ready = hasGps && hasDriver && hasTherapist;
  const actionLabel = currentReleasePlan.isDueNow ? "Release to Driver Now" : "Schedule Dispatch";

  function refreshAll() {
    onChanged();
  }

  function handleDriverAssign(driverId: string) {
    startTransition(async () => {
      const result = await assignBookingDriverAction({
        bookingId: currentItem.id,
        driverId,
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not assign driver.");
        return;
      }

      toast.success("Driver assigned.");
      refreshAll();
    });
  }

  function handleTherapistAssign(staffId: string, overrideReason?: string) {
    startTransition(async () => {
      const result = await assignBookingTherapistAction({
        bookingId: currentItem.id,
        staffId,
        overrideReason: overrideReason ?? "manager_decision",
      });

      if (!result.success) {
        toast.error(result.error ?? "Could not change therapist.");
        return;
      }

      toast.success("Therapist updated.");
      refreshAll();
    });
  }

  function handleDispatchOk(forceRelease: boolean) {
    if (!ready) {
      setFeedback("GPS, driver, and therapist must be ready before dispatch.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await prepareHomeServiceDispatchAction({
        bookingId: currentItem.id,
        releaseNow: forceRelease,
        note: "Dispatch prepared by CRM.",
      });

      if (!result.success) {
        setFeedback(result.error ?? "Could not prepare dispatch.");
        return;
      }

      toast.success(result.releasedNow ? "Trip released to driver." : "Dispatch scheduled.");
      refreshAll();
      onOpenChange(false);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-2xl">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[var(--cs-border)] px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--cs-text)]">
                Prepare Home Service Dispatch
              </h2>
              <Badge className="border-green-200 bg-green-50 text-green-700">
                Home Service
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
              Confirm driver, therapist, and GPS route. The system will release the trip when it is time to leave.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-[var(--cs-text-muted)] transition hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
            aria-label="Close dispatch modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--cs-surface-warm)] px-6 py-5">
          <div className="space-y-4">
            {/* Booking Summary */}
            <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-sm">
              <div className="flex items-center gap-2 border-b border-[var(--cs-border)] px-4 py-3">
                <StepBadge number={1} />
                <h3 className="font-bold text-[var(--cs-text)]">Booking Summary</h3>
              </div>

              <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCell icon={<UserRound size={15} />} label="Customer" value={currentItem.customerName} />
                <SummaryCell icon={<CheckCircle2 size={15} />} label="Services" value={currentItem.serviceName} />
                <SummaryCell
                  icon={<CalendarClock size={15} />}
                  label="Appointment"
                  value={`${currentItem.bookingDate} · ${formatTime12h(currentItem.startTime)}`}
                />
                <SummaryCell icon={<Clock size={15} />} label="Duration" value={currentItem.endTime ? `${formatTime12h(currentItem.startTime)} – ${formatTime12h(currentItem.endTime)}` : "Scheduled"} />
                <SummaryCell icon={<UserRound size={15} />} label="Current therapist" value={currentItem.therapistName ?? "Unassigned"} />
                <SummaryCell icon={<Car size={15} />} label="Current driver" value={currentItem.driverName ?? "Unassigned"} accent={!currentItem.driverName} />
                <SummaryCell icon={<Clock size={15} />} label="Booking status" value={currentItem.bookingStatus} />
                <SummaryCell icon={<Navigation size={15} />} label="Booking source" value="Online / CRM Booking" />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                {/* GPS Route */}
                <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <StepBadge number={2} />
                    <h3 className="font-bold text-[var(--cs-text)]">GPS / Route Status</h3>
                    <Badge
                      variant="outline"
                      className={hasGps ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}
                    >
                      {hasGps ? "GPS location ready" : "GPS missing"}
                    </Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                          Destination coordinates
                        </p>
                        <p className="font-semibold text-[var(--cs-text)]">
                          {formatCoordinate(currentItem.lat)}, {formatCoordinate(currentItem.lng)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                          Distance
                        </p>
                        <p className="font-semibold text-[var(--cs-text)]">
                          {currentItem.etaMinutes ? "Calculated from saved GPS" : "Uses saved booking coordinates"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                          ETA
                        </p>
                        <p className="font-semibold text-[var(--cs-text)]">
                          {currentReleasePlan.eta} min
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                          Suggested leave time
                        </p>
                        <p className="font-bold text-[#155A33]">
                          {formatClock(currentReleasePlan.releaseAt)}
                        </p>
                      </div>
                    </div>

                    <MiniGpsRoutePreview
                      branchName={currentItem.branchName}
                      branchLat={currentItem.branchLat}
                      branchLng={currentItem.branchLng}
                      lat={currentItem.lat}
                      lng={currentItem.lng}
                    />
                  </div>

                  <p className="mt-3 text-xs text-[var(--cs-text-muted)]">
                    Route uses the same saved branch GPS location used by Home Service distance pricing, then routes to the customer GPS destination.
                  </p>
                </section>

                {/* Dispatch timing */}
                <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <StepBadge number={5} />
                    <h3 className="font-bold text-[var(--cs-text)]">Dispatch Timing</h3>
                  </div>

                  <div className="grid gap-3 text-center sm:grid-cols-4">
                    <div className="rounded-xl bg-[var(--cs-surface-warm)] p-3">
                      <CalendarClock className="mx-auto mb-1 text-[var(--cs-text-muted)]" size={18} />
                      <p className="text-[0.65rem] text-[var(--cs-text-muted)]">Appointment time</p>
                      <p className="font-bold text-[var(--cs-text)]">{formatTime12h(currentItem.startTime)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--cs-surface-warm)] p-3">
                      <Car className="mx-auto mb-1 text-[var(--cs-text-muted)]" size={18} />
                      <p className="text-[0.65rem] text-[var(--cs-text-muted)]">Travel time</p>
                      <p className="font-bold text-[var(--cs-text)]">{currentReleasePlan.eta} min</p>
                    </div>
                    <div className="rounded-xl bg-[var(--cs-surface-warm)] p-3">
                      <Clock className="mx-auto mb-1 text-[var(--cs-text-muted)]" size={18} />
                      <p className="text-[0.65rem] text-[var(--cs-text-muted)]">Buffer</p>
                      <p className="font-bold text-[var(--cs-text)]">{DISPATCH_BUFFER_MINUTES} min</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-3">
                      <Send className="mx-auto mb-1 text-[#155A33]" size={18} />
                      <p className="text-[0.65rem] text-green-700">Release to driver</p>
                      <p className="font-bold text-[#155A33]">{formatClock(currentReleasePlan.releaseAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                    {currentReleasePlan.isDueNow
                      ? "Release time has arrived. This dispatch can be sent to the driver now."
                      : `Dispatch will be released automatically at ${formatClock(currentReleasePlan.releaseAt)}.`}
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                {/* Driver */}
                <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <StepBadge number={3} />
                    <h3 className="font-bold text-[var(--cs-text)]">Driver Assignment</h3>
                  </div>

                  <div className="mb-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                      Assigned Driver
                    </p>
                    <p className="mt-1 font-bold text-[var(--cs-text)]">
                      {currentItem.driverName ?? "No driver assigned"}
                    </p>
                  </div>

                  <CompactAssignmentPicker
                    kind="driver"
                    bookingId={currentItem.id}
                    currentStaffId={currentItem.driverId}
                    currentStaffName={currentItem.driverName}
                    fetchRecommendations={getDriverRecommendationsAction}
                    onSelect={(staffId) => handleDriverAssign(staffId)}
                  />
                </section>
                {/* Therapist */}
                <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <StepBadge number={4} />
                    <h3 className="font-bold text-[var(--cs-text)]">Therapist Confirmation</h3>
                  </div>

                  <div className="mb-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                      Current Therapist
                    </p>
                    <p className="mt-1 font-bold text-[var(--cs-text)]">
                      {currentItem.therapistName ?? "No therapist assigned"}
                    </p>
                  </div>

                  <CompactAssignmentPicker
                    kind="therapist"
                    bookingId={currentItem.id}
                    currentStaffId={currentItem.therapistId}
                    currentStaffName={currentItem.therapistName}
                    fetchRecommendations={getTherapistRecommendationsAction}
                    onSelect={handleTherapistAssign}
                  />

                  <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
                    Keep customer time unless therapist availability requires a change.
                  </p>
                </section>

                {/* Checklist */}
                <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <StepBadge number={6} />
                    <h3 className="font-bold text-[var(--cs-text)]">Dispatch Checklist</h3>
                  </div>

                  <div className="space-y-2">
                    <ChecklistRow checked={hasDriver} label="Driver assigned" />
                    <ChecklistRow checked={hasTherapist} label="Therapist confirmed" />
                    <ChecklistRow checked={hasGps} label="GPS location ready" />
                    <ChecklistRow checked={ready} label="Dispatch OK" />
                  </div>

                  <p className="mt-3 text-xs text-[var(--cs-text-muted)]">
                    Prepared early. The system notifies the assigned driver at the correct time.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--cs-border)] bg-[var(--cs-surface)] px-6 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
          {feedback ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {feedback}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl px-5"
            >
              Cancel
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                disabled={isPending || !ready}
                onClick={() => handleDispatchOk(true)}
                className="h-10 rounded-xl px-5"
              >
                Release Now
              </Button>

              <Button
                disabled={isPending || !ready}
                onClick={() => handleDispatchOk(false)}
                className="h-10 rounded-xl bg-[#155A33] px-5 font-bold text-white hover:bg-[#104728]"
              >
                <Send size={16} />
                {isPending ? "Saving..." : actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}









