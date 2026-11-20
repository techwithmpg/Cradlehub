"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type StationRole = "intake" | "cashier";

type StationAssignmentRecord = {
  station_role: StationRole;
  terminal_label: string;
  active_staff_id: string | null;
  active_staff_name: string | null;
  shift_label: string | null;
  updated_at: string;
};

type ClockedInCrmStaff = {
  staffId: string;
  fullName: string;
  clockedInAt: string;
};

const LOCAL_STATION_ROLE_KEY = "cradlehub:pc_station_role";
const LOCAL_STATION_ASSIGNMENTS_KEY = "cradlehub:branch_station_assignments";

export function CrmStationControlBar({
  branchId,
  branchName,
  currentUserId,
  currentStaffId,
  currentStaffName,
  role,
  variant = "bar",
}: {
  branchId: string;
  branchName: string;
  currentUserId?: string;
  currentStaffId?: string;
  currentStaffName: string;
  role: string;
  variant?: "bar" | "header";
}) {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // PC's bound role ("intake" for PC 1 Cradle Intake, "cashier" for PC 2 Cashier)
  const [thisPcStation, setThisPcStation] = useState<StationRole>("intake");
  const [intakeOperator, setIntakeOperator] = useState<string>(currentStaffName);
  const [cashierOperator, setCashierOperator] = useState<string>(currentStaffName);

  // Shift Handover & Day Close Wizards
  const [handoverWizardOpen, setHandoverWizardOpen] = useState(false);
  const [handoverStep, setHandoverStep] = useState<1 | 2 | 3>(1);
  const [incomingClockInAlert, setIncomingClockInAlert] = useState<ClockedInCrmStaff | null>(null);
  const [targetStationForHandover, setTargetStationForHandover] = useState<StationRole | "both">("both");
  const [incomingOperatorName, setIncomingOperatorName] = useState("");
  const [incomingStaffList, setIncomingStaffList] = useState<Array<{ id: string; name: string }>>([]);
  const [drawerExpectedCash, setDrawerExpectedCash] = useState<number>(0);
  const [drawerCountedCash, setDrawerCountedCash] = useState<string>("");
  const [activeCashSessionId, setActiveCashSessionId] = useState<string | null>(null);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [queueAudit, setQueueAudit] = useState({
    inServiceCount: 0,
    waitingCount: 0,
    unpaidCompletedCount: 0,
    pendingConfirmationCount: 0,
  });

  // Day Close Wizard
  const [dayCloseWizardOpen, setDayCloseWizardOpen] = useState(false);
  const [dayCloseStep, setDayCloseStep] = useState<1 | 2 | 3>(1);
  const [dayCloseCashCount, setDayCloseCashCount] = useState("");
  const [dayCloseNotes, setDayCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Load PC Station preference + active operators
  const loadStationState = useCallback(async () => {
    if (typeof window === "undefined") return;
    const savedPcRole = window.localStorage.getItem(LOCAL_STATION_ROLE_KEY) as StationRole | null;
    if (savedPcRole === "intake" || savedPcRole === "cashier") {
      setThisPcStation(savedPcRole);
    } else if (pathname.startsWith("/crm/cash-flow") || pathname.startsWith("/crm/reconciliation")) {
      setThisPcStation("cashier");
    }

    // Try reading from crm_station_assignments table first, fallback to localStorage
    try {
      const { data: rows, error } = await supabase
        .from("crm_station_assignments")
        .select("*")
        .eq("branch_id", branchId);
      if (!error && rows && rows.length > 0) {
        for (const r of rows as StationAssignmentRecord[]) {
          if (r.station_role === "intake" && r.active_staff_name) {
            setIntakeOperator(r.active_staff_name);
          }
          if (r.station_role === "cashier" && r.active_staff_name) {
            setCashierOperator(r.active_staff_name);
          }
        }
      } else {
        const localRaw = window.localStorage.getItem(`${LOCAL_STATION_ASSIGNMENTS_KEY}:${branchId}`);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed.intake) setIntakeOperator(parsed.intake);
          if (parsed.cashier) setCashierOperator(parsed.cashier);
        }
      }
    } catch {
      // fallback silently
    }
  }, [branchId, pathname, supabase]);

  // Load live operational counts & active cash drawer for Handover / Day Close wizards
  const loadOperationalSnapshot = useCallback(async () => {
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const [bookingsRes, cashSessionRes, staffRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, status, booking_progress_status, payment_status")
        .eq("branch_id", branchId)
        .eq("booking_date", today),
      supabase
        .from("cash_sessions")
        .select("id, opening_float, current_custodian_id, opened_by")
        .eq("branch_id", branchId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1),
      supabase
        .from("staff")
        .select("id, full_name, nickname, system_role")
        .eq("branch_id", branchId)
        .eq("is_active", true),
    ]);

    const bList = bookingsRes.data ?? [];
    setQueueAudit({
      inServiceCount: bList.filter((b) => b.booking_progress_status === "in_service").length,
      waitingCount: bList.filter((b) => b.booking_progress_status === "checked_in").length,
      unpaidCompletedCount: bList.filter(
        (b) =>
          (b.booking_progress_status === "completed" || b.status === "completed") &&
          b.payment_status !== "paid"
      ).length,
      pendingConfirmationCount: bList.filter((b) =>
        ["pending", "pending_crm_confirmation"].includes(b.status)
      ).length,
    });

    const openDrawer = cashSessionRes.data?.[0];
    if (openDrawer) {
      setActiveCashSessionId(openDrawer.id);
      const floatAmt = Number(openDrawer.opening_float ?? 0);
      setDrawerExpectedCash(floatAmt);
      if (!drawerCountedCash) setDrawerCountedCash(floatAmt.toFixed(2));
    }

    const crmEligible = (staffRes.data ?? [])
      .filter((s) =>
        ["crm", "manager", "store_manager", "assistant_manager", "owner"].includes(
          String(s.system_role)
        )
      )
      .map((s) => ({
        id: s.id,
        name: s.nickname || s.full_name,
      }));
    setIncomingStaffList(crmEligible);
    if (!incomingOperatorName && crmEligible.length > 0) {
      const other = crmEligible.find((s) => s.name !== currentStaffName) ?? crmEligible[0]!;
      setIncomingOperatorName(other.name);
    }
  }, [branchId, currentStaffName, drawerCountedCash, incomingOperatorName, supabase]);

  useEffect(() => {
    void loadStationState();
    void loadOperationalSnapshot();
  }, [loadStationState, loadOperationalSnapshot]);

  // Listen in realtime for CRM Staff Clock-Ins to automatically trigger Shift Handover!
  useEffect(() => {
    const channel = supabase
      .channel(`crm-shift-handover-${branchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_checkins",
          filter: `branch_id=eq.${branchId}`,
        },
        async (payload) => {
          const row = payload.new as { staff_id?: string; check_type?: string; checked_at?: string };
          if (!row?.staff_id || (row.check_type && row.check_type !== "clock_in" && row.check_type !== "in")) {
            return;
          }
          // Check if the clocked-in staff member is a CRM / Front Desk operator different from the current one
          const { data: staffRow } = await supabase
            .from("staff")
            .select("id, full_name, nickname, system_role")
            .eq("id", row.staff_id)
            .maybeSingle();

          if (
            staffRow &&
            ["crm", "manager", "store_manager", "assistant_manager"].includes(
              String(staffRow.system_role)
            )
          ) {
            const incomingName = staffRow.nickname || staffRow.full_name;
            if (incomingName !== currentStaffName) {
              setIncomingClockInAlert({
                staffId: staffRow.id,
                fullName: incomingName,
                clockedInAt: new Date().toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              });
              setIncomingOperatorName(incomingName);
              void loadOperationalSnapshot();
              toast.info(
                `Shift Change Detected: ${incomingName} just clocked in. Please initiate Station Handover.`
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, currentStaffName, loadOperationalSnapshot, supabase]);

  const handleBindThisPc = async (stationRole: StationRole) => {
    setThisPcStation(stationRole);
    window.localStorage.setItem(LOCAL_STATION_ROLE_KEY, stationRole);

    const nextIntake = stationRole === "intake" ? currentStaffName : intakeOperator;
    const nextCashier = stationRole === "cashier" ? currentStaffName : cashierOperator;
    if (stationRole === "intake") setIntakeOperator(currentStaffName);
    if (stationRole === "cashier") setCashierOperator(currentStaffName);

    window.localStorage.setItem(
      `${LOCAL_STATION_ASSIGNMENTS_KEY}:${branchId}`,
      JSON.stringify({ intake: nextIntake, cashier: nextCashier })
    );

    try {
      await supabase.from("crm_station_assignments").upsert(
        {
          branch_id: branchId,
          station_role: stationRole,
          terminal_label: stationRole === "intake" ? "PC-1 (Cradle Intake)" : "PC-2 (Cashier POS)",
          active_staff_id: currentStaffId ?? null,
          active_staff_name: currentStaffName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id,station_role" }
      );
    } catch {
      // fallback if SQL table not yet migrated
    }

    toast.success(
      stationRole === "intake"
        ? `This PC is now bound as PC 1 — Cradle Intake (${currentStaffName})`
        : `This PC is now bound as PC 2 — Cashier Station (${currentStaffName})`
    );
  };

  const handleCompleteHandoverWizard = async () => {
    if (!incomingOperatorName.trim()) {
      toast.error("Select the incoming CRM operator.");
      return;
    }
    setBusy(true);
    try {
      const nextIntake =
        targetStationForHandover === "intake" || targetStationForHandover === "both"
          ? incomingOperatorName
          : intakeOperator;
      const nextCashier =
        targetStationForHandover === "cashier" || targetStationForHandover === "both"
          ? incomingOperatorName
          : cashierOperator;

      setIntakeOperator(nextIntake);
      setCashierOperator(nextCashier);

      window.localStorage.setItem(
        `${LOCAL_STATION_ASSIGNMENTS_KEY}:${branchId}`,
        JSON.stringify({ intake: nextIntake, cashier: nextCashier })
      );

      // Persist to crm_station_assignments if table exists
      try {
        if (targetStationForHandover === "intake" || targetStationForHandover === "both") {
          await supabase.from("crm_station_assignments").upsert(
            {
              branch_id: branchId,
              station_role: "intake",
              terminal_label: "PC-1 (Cradle Intake)",
              active_staff_name: nextIntake,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "branch_id,station_role" }
          );
        }
        if (targetStationForHandover === "cashier" || targetStationForHandover === "both") {
          await supabase.from("crm_station_assignments").upsert(
            {
              branch_id: branchId,
              station_role: "cashier",
              terminal_label: "PC-2 (Cashier POS)",
              active_staff_name: nextCashier,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "branch_id,station_role" }
          );
        }
      } catch {
        // ignore if table not yet migrated
      }

      setHandoverWizardOpen(false);
      setIncomingClockInAlert(null);
      setHandoverStep(1);
      toast.success(`Station handover to ${incomingOperatorName} completed!`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // Hide control bar on full-screen Cradle Live TV display so the TV stays uncluttered
  if (pathname.startsWith("/crm/live-operations")) {
    return null;
  }

  // In header mode, only render on /crm/* routes (excluding full-screen live-operations TV)
  if (variant === "header" && (!pathname.startsWith("/crm") || pathname.startsWith("/crm/live-operations"))) {
    return null;
  }

  return (
    <>
      <div
        className={
          variant === "header"
            ? "flex min-w-0 flex-1 items-center justify-between gap-2"
            : "border-b border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2 text-xs"
        }
      >
        <div
          className={
            variant === "header"
              ? "flex min-w-0 flex-1 items-center justify-between gap-2"
              : "mx-auto flex flex-wrap items-center justify-between gap-2"
          }
        >
          {/* Left: Segmented PC Terminal Switcher + Unified Duty Pill */}
          <div className="flex min-w-0 items-center gap-2">
            <div
              role="group"
              aria-label="Active PC Station Role"
              className="inline-flex shrink-0 items-center rounded-full border border-[#E2DDD5] bg-[#F7F4EF] p-0.5 shadow-2xs"
            >
              <button
                type="button"
                onClick={() => void handleBindThisPc("intake")}
                className={`inline-flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold tracking-tight transition ${
                  thisPcStation === "intake"
                    ? "bg-[#164B36] text-white shadow-2xs"
                    : "text-[#5C5349] hover:text-[#1E1916]"
                }`}
                title="Bind this PC as PC 1: Cradle Intake (Walk-ins, Bookings & Session Tracking)"
              >
                <Monitor className="size-3 shrink-0" />
                <span>PC 1 · Intake</span>
              </button>
              <button
                type="button"
                onClick={() => void handleBindThisPc("cashier")}
                className={`inline-flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold tracking-tight transition ${
                  thisPcStation === "cashier"
                    ? "bg-[#164B36] text-white shadow-2xs"
                    : "text-[#5C5349] hover:text-[#1E1916]"
                }`}
                title="Bind this PC as PC 2: Cashier Station (Payments, Drawer, Boutique POS & Ledger)"
              >
                <Banknote className="size-3 shrink-0" />
                <span>PC 2 · Cashier</span>
              </button>
            </div>

            {/* Unified Duty Status Capsule */}
            <div className="hidden min-w-0 items-center gap-2 rounded-full border border-[#E6DFD5] bg-white px-2.5 py-1 text-[11px] text-[#3A322B] xl:inline-flex">
              <span className="inline-flex items-center gap-1 truncate">
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span className="text-[#786D61]">Intake:</span>
                <strong className="font-bold text-[#164B36]">{intakeOperator}</strong>
              </span>
              <span className="h-3 w-px bg-[#E6DFD5]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1 truncate">
                <span className="size-1.5 shrink-0 rounded-full bg-blue-600" />
                <span className="text-[#786D61]">Cashier:</span>
                <strong className="font-bold text-[#164B36]">{cashierOperator}</strong>
              </span>
            </div>
          </div>

          {/* Right: Sleek Station Operations Pill Group (Handover, Day Close, Lock) */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void loadOperationalSnapshot();
                setHandoverStep(1);
                setHandoverWizardOpen(true);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#D8E5DD] bg-[#F3F8F5] px-2.5 text-[11px] font-bold text-[#164B36] transition hover:border-[#164B36]/40 hover:bg-[#E5F1EA]"
              title="Open 3-step Station & Shift Handover Wizard"
            >
              <ArrowLeftRight className="size-3 shrink-0" />
              <span>Handover</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void loadOperationalSnapshot();
                setDayCloseStep(1);
                setDayCloseWizardOpen(true);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50/90 px-2.5 text-[11px] font-bold text-amber-950 transition hover:border-amber-400 hover:bg-amber-100/90"
              title="Open End-of-Day Close & Drawer Sign-Off Wizard"
            >
              <ClipboardCheck className="size-3 shrink-0 text-amber-800" />
              <span>Day Close</span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.sessionStorage.setItem("cradlehub:workspace_soft_locked", "1");
                window.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, key: "l" }));
              }}
              title="Lock screen in-place (Alt+L) — preserves your current page"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-[#E2DDD5] bg-white px-2.5 text-[11px] font-semibold text-[#5C5349] transition hover:border-[#C9C1B6] hover:bg-[#FAF8F5] hover:text-[#1E1916]"
            >
              <Lock className="size-3 shrink-0" />
              <span className="hidden 2xl:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Floating Shift-Change Alert Strip below the global top bar */}
        {incomingClockInAlert ? (
          <div className="fixed left-1/2 top-[58px] z-40 flex w-[min(92vw,760px)] -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-2.5 text-xs text-amber-950 shadow-lg backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-700" />
              <span>
                <strong>Shift Change Detected:</strong>{" "}
                <strong>{incomingClockInAlert.fullName}</strong> clocked in at{" "}
                {incomingClockInAlert.clockedInAt}. Transfer station custody when ready.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIncomingOperatorName(incomingClockInAlert.fullName);
                  setHandoverStep(1);
                  setHandoverWizardOpen(true);
                }}
                className="rounded-lg bg-[#164B36] px-3 py-1 font-bold text-white hover:bg-[#113A2A]"
              >
                Start Handover
              </button>
              <button
                type="button"
                onClick={() => setIncomingClockInAlert(null)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* =====================================================================
          3-STEP SHIFT HANDOVER WIZARD MODAL
         ===================================================================== */}
      {handoverWizardOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E5DED5] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EFEAE4] bg-[#FAF8F5] px-5 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#164B36]">
                  Step {handoverStep} of 3 · {branchName}
                </span>
                <h3 className="text-base font-bold text-[#1E1916]">
                  CRM Station & Shift Handover Wizard
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHandoverWizardOpen(false)}
                className="rounded-lg p-1 text-[#786D61] hover:bg-[#EFEAE4]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-xs">
              {handoverStep === 1 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 1 — Select Station & Audit Active Floor Queue:</strong> Review live sessions before transferring station responsibility.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["both", "Both Stations"],
                        ["intake", "PC 1: Intake Only"],
                        ["cashier", "PC 2: Cashier Only"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTargetStationForHandover(key)}
                        className={`rounded-xl border p-2.5 text-center font-bold transition ${
                          targetStationForHandover === key
                            ? "border-[#164B36] bg-[#EAF5EE] text-[#164B36]"
                            : "border-[#E5DED5] bg-white text-[#5C5349]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5">
                    <div>
                      <span className="text-[11px] text-[#786D61]">In-Service Sessions</span>
                      <p className="text-base font-extrabold text-[#1E1916]">{queueAudit.inServiceCount}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#786D61]">Checked-In / Waiting</span>
                      <p className="text-base font-extrabold text-[#1E1916]">{queueAudit.waitingCount}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#786D61]">Unpaid Completed</span>
                      <p className="text-base font-extrabold text-amber-800">{queueAudit.unpaidCompletedCount}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#786D61]">Pending Online Requests</span>
                      <p className="text-base font-extrabold text-[#164B36]">{queueAudit.pendingConfirmationCount}</p>
                    </div>
                  </div>
                </>
              ) : null}

              {handoverStep === 2 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 2 — Cash Drawer & Pending Collections Check:</strong> Confirm drawer cash before handing over custody.
                  </p>
                  <div className="rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#6B5D52]">Outgoing Operator:</span>
                      <strong className="text-[#1E1916]">{currentStaffName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B5D52]">Drawer Reference Float:</span>
                      <strong className="text-[#164B36]">₱{drawerExpectedCash.toLocaleString()}</strong>
                    </div>
                  </div>
                  <label className="block font-bold text-[#493F37]">
                    Physical Drawer Cash Counted (PHP)
                    <input
                      type="number"
                      step="0.01"
                      value={drawerCountedCash}
                      onChange={(e) => setDrawerCountedCash(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm font-bold"
                    />
                  </label>
                  <label className="block font-bold text-[#493F37]">
                    Shift Handover Notes (Optional)
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Any special guest instructions or change notes..."
                      className="mt-1 h-9 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-xs"
                    />
                  </label>
                </>
              ) : null}

              {handoverStep === 3 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 3 — Confirm Incoming CRM Operator:</strong> Select the clocked-in staff member taking over duty.
                  </p>
                  <label className="block font-bold text-[#493F37]">
                    Incoming CRM Operator
                    <select
                      value={incomingOperatorName}
                      onChange={(e) => setIncomingOperatorName(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm font-bold text-[#1E1916]"
                    >
                      {incomingStaffList.map((st) => (
                        <option key={st.id} value={st.name}>
                          {st.name}
                        </option>
                      ))}
                      {!incomingStaffList.some((s) => s.name === incomingOperatorName) && incomingOperatorName ? (
                        <option value={incomingOperatorName}>{incomingOperatorName}</option>
                      ) : null}
                    </select>
                  </label>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                    <p className="font-bold">Ready to Transfer Custody</p>
                    <p className="mt-0.5 text-[11px]">
                      {targetStationForHandover === "both"
                        ? "Both PC 1 (Cradle Intake) and PC 2 (Cashier)"
                        : targetStationForHandover === "intake"
                          ? "PC 1 (Cradle Intake)"
                          : "PC 2 (Cashier Station)"}{" "}
                      will now be recorded under <strong>{incomingOperatorName}</strong>.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EFEAE4] bg-[#FAF8F5] px-5 py-3.5 text-xs">
              {handoverStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setHandoverStep((s) => (s === 3 ? 2 : 1))}
                  className="rounded-xl border border-[#DCD4CA] bg-white px-3.5 py-2 font-semibold text-[#5C5349]"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {handoverStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setHandoverStep((s) => (s === 1 ? 2 : 3))}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#164B36] px-4 py-2 font-bold text-white"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCompleteHandoverWizard()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#164B36] px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>{busy ? "Saving…" : "Complete Station Handover"}</span>
                    </button>
                    {activeCashSessionId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHandoverWizardOpen(false);
                          router.push(`/crm/cash-flow?handover=${encodeURIComponent(activeCashSessionId)}`);
                        }}
                        className="rounded-xl border border-[#164B36] bg-white px-3 py-2 font-bold text-[#164B36]"
                      >
                        Full Drawer Audit
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          3-STEP END-OF-DAY (DAY CLOSE) WIZARD MODAL
         ===================================================================== */}
      {dayCloseWizardOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E5DED5] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EFEAE4] bg-[#FAF8F5] px-5 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  End-of-Day Wizard · Step {dayCloseStep} of 3
                </span>
                <h3 className="text-base font-bold text-[#1E1916]">
                  Branch Day Close & Station Sign-Off
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDayCloseWizardOpen(false)}
                className="rounded-lg p-1 text-[#786D61] hover:bg-[#EFEAE4]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 p-5 text-xs">
              {dayCloseStep === 1 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 1 — Unresolved Sessions & Unpaid Bookings Check:</strong> Ensure all today's appointments are completed and settled before closing the day.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5">
                    <div>
                      <span className="text-[11px] text-[#786D61]">Still In-Service</span>
                      <p className="text-base font-extrabold text-[#1E1916]">{queueAudit.inServiceCount}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#786D61]">Unpaid Completed Sessions</span>
                      <p className="text-base font-extrabold text-rose-700">{queueAudit.unpaidCompletedCount}</p>
                    </div>
                  </div>
                  {queueAudit.inServiceCount > 0 || queueAudit.unpaidCompletedCount > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                      There are still open or unpaid sessions today. You can settle them in Cradle Intake / Cash Flow or document a rollover reason in Step 2.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-950">
                      All active sessions and completed bookings are settled!
                    </div>
                  )}
                </>
              ) : null}

              {dayCloseStep === 2 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 2 — Final Cash Drawer Count:</strong> Enter the final physical cash in the drawer before sealing the business day.
                  </p>
                  <label className="block font-bold text-[#493F37]">
                    Final Physical Cash Count (PHP)
                    <input
                      type="number"
                      step="0.01"
                      value={dayCloseCashCount}
                      onChange={(e) => setDayCloseCashCount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 h-10 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm font-bold"
                    />
                  </label>
                  <label className="block font-bold text-[#493F37]">
                    Closing Notes / Variance Explanation
                    <input
                      type="text"
                      value={dayCloseNotes}
                      onChange={(e) => setDayCloseNotes(e.target.value)}
                      placeholder="End of day remarks..."
                      className="mt-1 h-9 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-xs"
                    />
                  </label>
                </>
              ) : null}

              {dayCloseStep === 3 ? (
                <>
                  <p className="text-[#5C5349]">
                    <strong>Step 3 — Seal Ledger & Submit Day Close:</strong> Proceed to final reconciliation sign-off to lock today's Cash Flow & Close Drawer.
                  </p>
                  <div className="rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5 space-y-1.5">
                    <div className="flex justify-between">
                      <span>Intake Operator:</span>
                      <strong>{intakeOperator}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Cashier Operator:</span>
                      <strong>{cashierOperator}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Counted Closing Cash:</span>
                      <strong className="text-[#164B36]">
                        ₱{Number(dayCloseCashCount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#EFEAE4] bg-[#FAF8F5] px-5 py-3.5 text-xs">
              {dayCloseStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setDayCloseStep((s) => (s === 3 ? 2 : 1))}
                  className="rounded-xl border border-[#DCD4CA] bg-white px-3.5 py-2 font-semibold text-[#5C5349]"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {dayCloseStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setDayCloseStep((s) => (s === 1 ? 2 : 3))}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#164B36] px-4 py-2 font-bold text-white"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDayCloseWizardOpen(false);
                        toast.success("Opening Day Close & Drawer Seal...");
                        router.push("/crm/cash-flow?tab=day-close");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#164B36] px-4 py-2 font-bold text-white"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>Finalize in Cash Flow Day Close</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDayCloseWizardOpen(false);
                        router.push("/crm/reconciliation");
                      }}
                      className="rounded-xl border border-[#164B36] bg-white px-3 py-2 font-bold text-[#164B36]"
                    >
                      Open Reconciliation Sheet
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
