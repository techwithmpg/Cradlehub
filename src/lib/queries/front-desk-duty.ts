import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import { BRANCH_TIMEZONE, getBranchTime } from "@/lib/engine/slot-time";
import type { FrontDeskContext } from "@/lib/queries/crm-context";
import { dutyWindowAt, shouldRemindHandover } from "@/lib/queries/front-desk-duty-contract";

export type FrontDeskDutyContext = {
  name: string;
  shiftLabel: string | null;
  activeOperator: boolean;
  confirmedHandover: boolean;
  handover: { sessionId: string; outgoingName: string; shiftLabel: string } | null;
};

export async function getFrontDeskDutyContext(
  context: FrontDeskContext,
  businessDate: string,
  handoverId?: string
): Promise<FrontDeskDutyContext | null> {
  // Owner branch viewing is not evidence of operator duty.
  if (context.role !== "crm") return null;
  const supabase = await createClient();
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, branch_id, full_name, nickname, staff_type, system_role")
    .eq("auth_user_id", context.userId)
    .eq("is_active", true)
    .maybeSingle();
  if (staffError || !staff || staff.branch_id !== context.branchId) return null;

  const result: FrontDeskDutyContext = {
    name: staff.nickname || staff.full_name,
    shiftLabel: null,
    activeOperator: false,
    confirmedHandover: false,
    handover: null,
  };
  try {
    const schedules = await getResolvedStaffSchedulesForDate({
      supabase,
      branchId: context.branchId,
      date: businessDate,
      staff: [{ id: staff.id, staff_type: staff.staff_type, system_role: staff.system_role }],
    });
    const window = dutyWindowAt(
      schedules.get(staff.id),
      getBranchTime(new Date(), BRANCH_TIMEZONE).minutesIntoDay
    );
    if (window) {
      result.shiftLabel =
        window.shiftType === "single"
          ? "Front Desk duty"
          : `${window.shiftType === "opening" ? "Opening" : "Closing"} CSR duty`;
    }

    type Session = {
      id: string;
      branch_id: string;
      opened_by: string;
      current_custodian_id: string | null;
    };
    const sessionClient = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string
          ) => {
            eq: (
              column: string,
              value: string
            ) => {
              order: (
                column: string,
                options: { ascending: boolean }
              ) => Promise<{
                data: Session[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };
    const { data: sessions, error: sessionError } = await sessionClient
      .from("cash_sessions")
      .select("id, branch_id, opened_by, current_custodian_id")
      .eq("branch_id", context.branchId)
      .eq("status", "open")
      .order("opened_at", { ascending: false });
    if (sessionError || !sessions?.length) return result;
    const ownSession = sessions.find(
      (session) => (session.current_custodian_id || session.opened_by) === staff.id
    );
    result.activeOperator = Boolean(ownSession);
    if (ownSession && handoverId && /^[0-9a-f-]{36}$/i.test(handoverId)) {
      type Handover = {
        id: string;
        cash_session_id: string;
        branch_id: string;
        incoming_custodian_id: string;
      };
      const handoverClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string
            ) => {
              order: (
                column: string,
                options: { ascending: boolean }
              ) => {
                limit: (count: number) => Promise<{ data: Handover[] | null; error: unknown }>;
              };
            };
          };
        };
      };
      const { data: handovers, error: handoverError } = await handoverClient
        .from("cash_session_handovers")
        .select("id, cash_session_id, branch_id, incoming_custodian_id")
        .eq("cash_session_id", ownSession.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = handovers?.[0];
      result.confirmedHandover =
        !handoverError &&
        Boolean(
          latest &&
          latest.id === handoverId &&
          latest.branch_id === context.branchId &&
          latest.incoming_custodian_id === staff.id
        );
    }
    if (!window || ownSession) return result;
    const session = sessions[0];
    if (!session) return result;
    const custodianId = session.current_custodian_id || session.opened_by;
    if (
      !shouldRemindHandover({
        role: context.role,
        staffId: staff.id,
        staffBranchId: staff.branch_id,
        viewedBranchId: context.branchId,
        scheduledNow: true,
        sessionBranchId: session.branch_id,
        custodianId,
      })
    )
      return result;
    const { data: outgoing, error: outgoingError } = await supabase
      .from("staff")
      .select("full_name, nickname")
      .eq("id", custodianId)
      .eq("branch_id", context.branchId)
      .maybeSingle();
    if (outgoingError || !outgoing) return result;
    result.handover = {
      sessionId: session.id,
      outgoingName: outgoing.nickname || outgoing.full_name,
      shiftLabel: result.shiftLabel || "Front Desk duty",
    };
  } catch {
    // Missing or inaccessible evidence must not become a guessed duty or reminder.
  }
  return result;
}
