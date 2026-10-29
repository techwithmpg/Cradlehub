"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Sparkles,
  User,
  DoorOpen,
  Pencil,
  Calendar,
  Home,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { useAdministrativeBookingModal } from "./administrative-booking-modal-provider";
import {
  rescheduleBookingAction,
  assignBookingTherapistAction,
  assignBookingRoomAction,
  getRoomAssignmentOptionsAction,
  type RoomAssignmentResourceOption,
} from "@/app/(dashboard)/crm/bookings/actions";
import { getTherapistRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";
import { firstBookingRelation } from "@/lib/bookings/booking-display";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";

type HorizontalBookingQuickEditProps = {
  group: CrmBookingGroup;
  onCancel: () => void;
  onSaved: () => void;
  onPartialSave?: () => void;
  onOpenFallbackReschedule?: (booking: WorkspaceBookingRow) => void;
};

type SavedLineBaseline = {
  lineId: string;
  date: string;
  time: string;
  notes: string;
  staffId: string;
  resourceId: string;
};

function readBookingNote(line: WorkspaceBookingRow): string {
  const meta = line.metadata;
  if (!meta) return "";
  const candidate = meta.customer_notes ?? meta.note ?? meta.notes;
  return typeof candidate === "string" ? candidate : "";
}

function readHomeServiceAddress(line: WorkspaceBookingRow): string | undefined {
  const raw = line.metadata?.home_service_address;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const fullAddress = (raw as Record<string, unknown>).full_address;
    if (typeof fullAddress === "string" && fullAddress.trim()) {
      return fullAddress.trim();
    }
  }
  return undefined;
}

function readHomeServiceAccessNote(line: WorkspaceBookingRow): string | undefined {
  const direct = line.metadata?.home_service_access_note;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const raw = line.metadata?.home_service_address;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const accessNote = (raw as Record<string, unknown>).access_note;
    if (typeof accessNote === "string" && accessNote.trim()) {
      return accessNote.trim();
    }
  }
  return undefined;
}

function createLineBaseline(line: WorkspaceBookingRow): SavedLineBaseline {
  const staffRel = firstBookingRelation(line.staff);
  const resourceRel = firstBookingRelation(line.branch_resources);
  return {
    lineId: line.id,
    date: line.booking_date,
    time: line.start_time.slice(0, 5),
    notes: readBookingNote(line).trim(),
    staffId: line.staff_id ?? staffRel?.id ?? "",
    resourceId: line.resource_id ?? resourceRel?.id ?? "",
  };
}

export function HorizontalBookingQuickEdit({
  group,
  onCancel,
  onSaved,
  onPartialSave,
  onOpenFallbackReschedule,
}: HorizontalBookingQuickEditProps) {
  let modalContext: ReturnType<typeof useAdministrativeBookingModal> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modalContext = useAdministrativeBookingModal();
  } catch {
    modalContext = null;
  }

  const services = useMemo(() => modalContext?.services ?? [], [modalContext]);
  const allStaff = useMemo(() => modalContext?.staff ?? [], [modalContext]);
  const allResources = useMemo(() => modalContext?.resources ?? [], [modalContext]);

  // Multi-guest support: line selection
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const activeLine: WorkspaceBookingRow = group.lines[selectedLineIndex] ?? group.lines[0]!;

  const isHomeService = isHomeServiceBooking(activeLine);
  const initialCustomer = firstBookingRelation(activeLine.customers);
  const initialService = firstBookingRelation(activeLine.services);
  const initialStaff = firstBookingRelation(activeLine.staff);
  const initialResource = firstBookingRelation(activeLine.branch_resources);

  const initialServiceId = initialService?.id ?? "";
  const initialStaffId = activeLine.staff_id ?? initialStaff?.id ?? "";
  const initialResourceId = activeLine.resource_id ?? initialResource?.id ?? "";

  // Form states
  const [date, setDate] = useState<string>(activeLine.booking_date);
  const [time, setTime] = useState<string>(activeLine.start_time.slice(0, 5));
  const [serviceId, setServiceId] = useState<string>(initialServiceId);
  const [staffId, setStaffId] = useState<string>(initialStaffId);
  const [resourceId, setResourceId] = useState<string>(initialResourceId);
  const [notes, setNotes] = useState<string>(() => readBookingNote(activeLine));
  const [saveError, setSaveError] = useState<string | null>(null);

  const savedBaselineRef = useRef<SavedLineBaseline>(createLineBaseline(activeLine));

  // Smart availability states
  const [recommendedStaff, setRecommendedStaff] = useState<ScoredStaff[]>([]);
  const [roomOptions, setRoomOptions] = useState<RoomAssignmentResourceOption[]>([]);
  const [isSaving, startSaveTransition] = useTransition();

  // Service change restriction flag: Changing a service modifies commercial pricing snapshots
  const serviceChanged = Boolean(serviceId && initialServiceId && serviceId !== initialServiceId);

  const serviceSelectOptions = useMemo(() => {
    const list = services.map((svc) => ({
      id: svc.id,
      name: svc.name,
      durationMinutes: svc.durationMinutes,
    }));
    if (initialService?.id && !list.some((item) => item.id === initialService.id)) {
      list.unshift({
        id: initialService.id,
        name: initialService.name,
        durationMinutes: initialService.duration_minutes ?? 60,
      });
    }
    return list;
  }, [initialService, services]);

  const fallbackStaffOptions = useMemo(() => {
    const list = [...allStaff];
    if (initialStaffId && !list.some((item) => item.id === initialStaffId)) {
      list.unshift({
        id: initialStaffId,
        name: initialStaff?.full_name || initialStaff?.nickname || "Assigned Therapist",
        nickname: initialStaff?.nickname ?? null,
        serviceIds: [],
      });
    }
    return list;
  }, [allStaff, initialStaff, initialStaffId]);

  const fallbackResourceOptions = useMemo(() => {
    const list = [...allResources];
    if (initialResourceId && !list.some((item) => item.id === initialResourceId)) {
      list.unshift({
        id: initialResourceId,
        name: initialResource?.name || "Assigned Room",
        type: initialResource?.type ?? null,
      });
    }
    return list;
  }, [allResources, initialResource, initialResourceId]);

  // Load smart recommendations
  useEffect(() => {
    let cancelled = false;

    async function loadSmartOptions() {
      try {
        const [staffRecs, roomRecs] = await Promise.all([
          getTherapistRecommendationsAction({ bookingId: activeLine.id }),
          !isHomeService
            ? getRoomAssignmentOptionsAction({ bookingId: activeLine.id })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (staffRecs && staffRecs.success && staffRecs.data?.therapists) {
          setRecommendedStaff(staffRecs.data.therapists);
        }

        if (roomRecs && roomRecs.success && !roomRecs.notApplicable && roomRecs.resources) {
          setRoomOptions(roomRecs.resources);
        }
      } catch (err) {
        console.error("Failed to load smart options for Quick Edit", err);
      }
    }

    void loadSmartOptions();

    return () => {
      cancelled = true;
    };
  }, [activeLine.id, isHomeService]);

  // Handle Reschedule: Opens the existing CradleHub booking modal Phone/Future interface with preloaded values
  function handleOpenReschedule() {
    if (modalContext?.openBookingModal) {
      modalContext.openBookingModal({
        mode: isHomeService ? "home_service" : "phone",
        rescheduleBookingId: activeLine.id,
        rescheduleOrderId: group.orderId ?? null,
        customerId: initialCustomer?.id,
        name: initialCustomer?.full_name ?? "",
        phone: initialCustomer?.phone ?? "",
        serviceId: initialServiceId || serviceId,
        staffId: staffId || undefined,
        resourceId: !isHomeService ? resourceId || undefined : undefined,
        date,
        time,
        notes,
        homeServiceAddress: readHomeServiceAddress(activeLine),
        homeServiceAccessNote: readHomeServiceAccessNote(activeLine),
      });
    } else {
      onOpenFallbackReschedule?.(activeLine);
    }
  }

  // Handle Save Changes: Executes authorized operations with partial-failure protection
  function handleSaveChanges() {
    if (serviceChanged) {
      toast.error("Service change requires Reschedule", {
        description:
          "Modifying a purchased service affects commercial snapshots and billing. Please click Reschedule to update.",
      });
      return;
    }

    if (savedBaselineRef.current.lineId !== activeLine.id) {
      savedBaselineRef.current = createLineBaseline(activeLine);
    }
    const baseline = savedBaselineRef.current;
    if (!staffId && baseline.staffId) {
      const msg = "Select an available therapist before saving.";
      setSaveError(msg);
      toast.error("Failed to assign therapist", { description: msg });
      return;
    }

    if (!isHomeService && !resourceId && baseline.resourceId) {
      const msg = "Select an available room before saving.";
      setSaveError(msg);
      toast.error("Failed to assign room", { description: msg });
      return;
    }

    setSaveError(null);

    startSaveTransition(async () => {
      const completedSteps: string[] = [];

      try {
        const currentBaseline = savedBaselineRef.current;
        const dateChanged = date !== currentBaseline.date;
        const timeChanged = time !== currentBaseline.time;
        const noteChanged = notes.trim() !== currentBaseline.notes;
        const staffChanged = Boolean(staffId) && staffId !== currentBaseline.staffId;
        const roomChanged =
          !isHomeService && Boolean(resourceId) && resourceId !== currentBaseline.resourceId;

        if (dateChanged || timeChanged || noteChanged) {
          const rescheduleRes = await rescheduleBookingAction({
            bookingId: activeLine.id,
            date,
            startTime: time.length === 5 ? `${time}:00` : time,
            note: notes.trim() || undefined,
          });

          if (!rescheduleRes.success) {
            const errMsg = rescheduleRes.error || "Unable to save date/time.";
            setSaveError(errMsg);
            toast.error("Failed to update schedule", {
              description: errMsg,
            });
            return;
          }

          completedSteps.push("Schedule");
          savedBaselineRef.current = {
            ...savedBaselineRef.current,
            date,
            time,
            notes: notes.trim(),
          };
        }

        if (staffChanged) {
          const staffRes = await assignBookingTherapistAction({
            bookingId: activeLine.id,
            staffId,
            overrideReason: "other",
          });

          if (!staffRes.success) {
            const reason = staffRes.error || "Selected therapist could not be assigned.";
            if (completedSteps.length > 0) {
              const partialMsg = `Partial update: ${completedSteps.join(" and ")} saved, but therapist assignment failed (${reason}).`;
              setSaveError(partialMsg);
              toast.error("Partial update — therapist assignment failed", {
                description: partialMsg,
              });
              onPartialSave?.();
            } else {
              setSaveError(reason);
              toast.error("Failed to assign therapist", {
                description: reason,
              });
            }
            return;
          }

          completedSteps.push("Therapist");
          savedBaselineRef.current = {
            ...savedBaselineRef.current,
            staffId,
          };
        }

        if (roomChanged) {
          const roomRes = await assignBookingRoomAction({
            bookingId: activeLine.id,
            resourceId,
          });

          if (!roomRes.success) {
            const reason = roomRes.error || "Selected room could not be assigned.";
            if (completedSteps.length > 0) {
              const partialMsg = `Partial update: ${completedSteps.join(" and ")} saved, but room assignment failed (${reason}).`;
              setSaveError(partialMsg);
              toast.error("Partial update — room assignment failed", {
                description: partialMsg,
              });
              onPartialSave?.();
            } else {
              setSaveError(reason);
              toast.error("Failed to assign room", {
                description: reason,
              });
            }
            return;
          }

          completedSteps.push("Room");
          savedBaselineRef.current = {
            ...savedBaselineRef.current,
            resourceId,
          };
        }

        toast.success("Booking updated", {
          description: "Changes have been saved successfully.",
        });
        onSaved();
      } catch (err) {
        console.error("Save changes error", err);
        if (completedSteps.length > 0) {
          const partialMsg = `Partial update: ${completedSteps.join(" and ")} saved before an unexpected error occurred. Please review remaining fields.`;
          setSaveError(partialMsg);
          toast.error("Partial update — could not complete all changes", {
            description: partialMsg,
          });
          onPartialSave?.();
        } else {
          setSaveError("Could not save changes. Please try again.");
          toast.error("Could not save changes. Please try again.");
        }
      }
    });
  }

  return (
    <div className="border-t border-neutral-200/90 bg-[#fbfdfc] px-5 py-4 rounded-b-xl shadow-inner">
      {/* Multi-guest tabs if more than 1 attendee */}
      {group.lines.length > 1 ? (
        <div className="mb-3 flex items-center gap-2 border-b border-neutral-200/60 pb-2">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Select Guest:
          </span>
          {group.lines.map((line, idx) => {
            const guestName =
              firstBookingRelation(line.customers)?.full_name ??
              (idx === 0 ? "Organizer" : `Guest ${idx + 1}`);
            const isSelected = selectedLineIndex === idx;
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => {
                  setSelectedLineIndex(idx);
                  const newSvc = firstBookingRelation(line.services);
                  const newStaff = firstBookingRelation(line.staff);
                  const newRes = firstBookingRelation(line.branch_resources);
                  setDate(line.booking_date);
                  setTime(line.start_time.slice(0, 5));
                  setServiceId(newSvc?.id ?? "");
                  setStaffId(line.staff_id ?? newStaff?.id ?? "");
                  setResourceId(line.resource_id ?? newRes?.id ?? "");
                  setNotes(readBookingNote(line));
                  setSaveError(null);
                  savedBaselineRef.current = createLineBaseline(line);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isSelected
                    ? "bg-[#006044] text-white shadow-sm"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {guestName}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Top row: Title on left, Action buttons on right */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-full bg-[#e6f4ee] text-[#006044]">
            <Pencil className="size-3.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neutral-900 leading-none">
              Quick Edit Booking
            </h4>
            <p className="mt-1 text-xs text-neutral-500 leading-none">
              Update details without leaving this page.
            </p>
          </div>
        </div>

        {/* Action buttons matching approved screenshot EXACT order: Cancel | Reschedule | Save Changes */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenReschedule}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-50"
          >
            <Calendar className="size-3.5 text-neutral-500" />
            Reschedule
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving || serviceChanged}
            className="flex items-center gap-1.5 rounded-lg bg-[#006044] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#004d37] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Save / Partial Save Error Alert */}
      {saveError ? (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>{saveError}</span>
        </div>
      ) : null}

      {/* Financial Protection Guard Message if user selects different service */}
      {serviceChanged ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <span>
            <strong>Commercial Protection:</strong> Changing a booked service modifies pricing
            records. Use the <strong>Reschedule</strong> button above to re-quote and update
            services safely.
          </span>
        </div>
      ) : null}

      {/* Grid Fields matching approved design */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Date & Time */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Date & Time
          </label>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <CalendarDays className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="date"
                aria-label="Booking date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-xs text-neutral-800 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
              />
            </div>
            <div className="relative w-28">
              <Clock className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="time"
                aria-label="Booking time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-2 text-xs text-neutral-800 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
              />
            </div>
          </div>
        </div>

        {/* Service */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Service
          </label>
          <div className="relative">
            <Sparkles className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <select
              aria-label="Service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={`h-9 w-full appearance-none rounded-lg border bg-white pl-8 pr-7 text-xs text-neutral-800 focus:outline-none focus:ring-1 ${
                serviceChanged
                  ? "border-amber-400 focus:ring-amber-400"
                  : "border-neutral-200 focus:border-[#006044] focus:ring-[#006044]"
              }`}
            >
              {serviceSelectOptions.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.durationMinutes}m)
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Therapist */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Therapist
          </label>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <select
              aria-label="Therapist"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-8 pr-7 text-xs text-neutral-800 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
            >
              <option value="">Unassigned</option>
              {/* If we have recommended staff, display them with recommendations */}
              {recommendedStaff.length > 0 ? (
                <>
                  {recommendedStaff.map((st) => {
                    const isCurrent = st.staffId === initialStaffId;
                    const isUnavailable = st.status === "unavailable" && !isCurrent;
                    return (
                      <option
                        key={st.staffId}
                        value={st.staffId}
                        disabled={isUnavailable}
                      >
                        {st.displayName}{" "}
                        {isCurrent
                          ? "(Current)"
                          : st.status === "recommended"
                            ? "(Recommended)"
                            : st.status === "unavailable"
                              ? "(Unavailable)"
                              : ""}
                      </option>
                    );
                  })}
                </>
              ) : (
                /* Fallback to allStaff options */
                fallbackStaffOptions.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.id === initialStaffId ? "(Current)" : ""}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
              ▼
            </div>
          </div>
        </div>

        {/* Room */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Room
          </label>
          {isHomeService ? (
            <div className="flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/60 px-3 text-xs text-purple-700">
              <Home className="size-3.5 text-purple-500" />
              <span>Home Service (No room required)</span>
            </div>
          ) : (
            <div className="relative">
              <DoorOpen className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                aria-label="Room"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="h-9 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-8 pr-7 text-xs text-neutral-800 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
              >
                <option value="">No Room Assigned</option>
                {roomOptions.length > 0 ? (
                  roomOptions.map((res) => (
                    <option
                      key={res.id}
                      value={res.id}
                      disabled={!res.isAvailable && !res.isCurrent}
                    >
                      {res.name}{" "}
                      {res.isCurrent
                        ? "(Current)"
                        : res.isRecommended
                          ? "(Recommended)"
                          : !res.isAvailable
                            ? "(Occupied)"
                            : ""}
                    </option>
                  ))
                ) : (
                  fallbackResourceOptions.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} {res.id === initialResourceId ? "(Current)" : ""}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                ▼
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Notes input */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Notes (optional)
        </label>
        <input
          type="text"
          aria-label="Booking notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add booking notes..."
          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-[#006044] focus:outline-none focus:ring-1 focus:ring-[#006044]"
        />
      </div>
    </div>
  );
}
