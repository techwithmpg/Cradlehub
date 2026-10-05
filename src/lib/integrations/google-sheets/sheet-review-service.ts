import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { canViewMasterSheetReview } from "@/lib/auth/crm-permissions";
import { logInfo } from "@/lib/logger";
import { selectSheetTokenProvider } from "./sheet-token-provider-selector";
import { createGoogleSheetsReader, type SheetReader, type SheetReadPhase } from "./sheet-reader";
import { projectSheetRead, type SheetReviewState } from "./sheet-review-projection";

export async function hasMasterSheetReviewAccess(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (await resolveSuperAdminContext(user.id)) return true;
  const { data: staff, error } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return !error && canViewMasterSheetReview(canonicalizeSystemRole(staff?.system_role ?? ""));
}

export type MasterSheetReviewResult = SheetReviewState | { status: "forbidden" };

/** Authorization precedes every Sheet read. Injection is used only by focused tests. */
export async function loadMasterSheetReview(
  options: {
    authorize?: () => Promise<boolean>;
    reader?: SheetReader;
    now?: () => Date;
    workbookId?: string;
  } = {}
): Promise<MasterSheetReviewResult> {
  const started = performance.now();
  let authorized = false;
  try {
    authorized = await (options.authorize ?? hasMasterSheetReviewAccess)();
  } catch {
    /* Fail closed. */
  }
  const authorizationMs = Math.round(performance.now() - started);
  if (!authorized) return { status: "forbidden" };

  const timings: Partial<Record<SheetReadPhase, number>> = {};
  let state: SheetReviewState;
  let adapterMs = 0;
  try {
    const reader =
      options.reader ??
      createGoogleSheetsReader({
        spreadsheetId: options.workbookId,
        tokenProvider: selectSheetTokenProvider() ?? undefined,
        onTiming: (phase, milliseconds) => {
          timings[phase] = (timings[phase] ?? 0) + milliseconds;
        },
      });
    const result = await reader.readCurrentAndPrevious();
    const adapterStarted = performance.now();
    state = projectSheetRead(result, (options.now ?? (() => new Date()))().toISOString());
    adapterMs = Math.round(performance.now() - adapterStarted);
  } catch {
    state = {
      status: "unavailable",
      observedAt: (options.now ?? (() => new Date()))().toISOString(),
    };
  }
  logInfo("master_sheet.review.load", {
    status: state.status,
    authorizationMs,
    authMs: timings.auth ?? null,
    metadataMs: timings.metadata ?? null,
    tabReadMs: timings.tab_read ?? null,
    parseMs: timings.parse ?? null,
    adapterMs,
    totalMs: Math.round(performance.now() - started),
  });
  return state;
}
