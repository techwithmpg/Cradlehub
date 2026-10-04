import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canViewMasterSheetReview } from "@/lib/auth/crm-permissions";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { logInfo } from "@/lib/logger";
import { businessDateInManila, addDays } from "./sheet-week";
import { hasMasterSheetReviewAccess } from "./sheet-review-service";
import {
  createGoogleSheetsReader,
  CRADLE_MAINSHEETS_SPREADSHEET_ID,
  type SheetReader,
  type SheetReadPhase,
} from "./sheet-reader";
import { selectSheetTokenProvider } from "./sheet-token-provider-selector";
import { projectNativeReferences } from "./sheet-native-projection";
import { resolveWorkbookSource, type ActiveBranch } from "./workbook-source-map";
import type { SheetNativeReferencesState } from "./sheet-native-types";

type AuthorizedViewer = { branchId: string; role: string };

async function getNativeViewer(): Promise<AuthorizedViewer | null> {
  // Match Stage 1D's active-staff/super-admin gate before credentials are selected.
  if (!(await hasMasterSheetReviewAccess())) return null;
  const context = await getFrontDeskContext();
  return canViewMasterSheetReview(context.role)
    ? { branchId: context.branchId, role: context.role }
    : null;
}

async function getActiveBranches(): Promise<ActiveBranch[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true);
  return error ? null : (data ?? []);
}

/** Only the current and previous business weeks can be projected natively. */
export function isInNativeSheetWindow(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    return false;
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return false;
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const currentStart = addDays(today, -((day - 5 + 7) % 7));
  return date >= addDays(currentStart, -7) && date <= addDays(currentStart, 6);
}

/** Optional Sheet resource: every failure is isolated from canonical CRM loaders. */
export async function loadSheetNativeReferences(
  date: string,
  options: {
    authorize?: () => Promise<AuthorizedViewer | null>;
    branches?: () => Promise<ActiveBranch[] | null>;
    reader?: SheetReader;
    now?: () => Date;
  } = {}
): Promise<SheetNativeReferencesState> {
  const started = performance.now();
  const now = options.now?.() ?? new Date();
  const observedAt = now.toISOString();
  const timings: Partial<Record<SheetReadPhase, number>> = {};
  try {
    const authorizationStarted = performance.now();
    const viewer = await (options.authorize ?? getNativeViewer)();
    if (!viewer || !canViewMasterSheetReview(viewer.role))
      return { status: "forbidden", observedAt };
    const authorizationMs = Math.round(performance.now() - authorizationStarted);
    const branches = await (options.branches ?? getActiveBranches)();
    const mapping = branches && resolveWorkbookSource(CRADLE_MAINSHEETS_SPREADSHEET_ID, branches);
    if (!mapping || mapping.branchId !== viewer.branchId)
      return { status: "forbidden", observedAt };
    if (!isInNativeSheetWindow(date, businessDateInManila(now))) {
      return { status: "outside_loaded_window", observedAt };
    }
    const reader =
      options.reader ??
      createGoogleSheetsReader({
        tokenProvider: selectSheetTokenProvider() ?? undefined,
        onTiming: (phase, milliseconds) => {
          timings[phase] = (timings[phase] ?? 0) + milliseconds;
        },
      });
    const read = await reader.readCurrentAndPrevious(businessDateInManila(now));
    const projectionStarted = performance.now();
    const state =
      read.status === "available"
        ? projectNativeReferences(read, mapping, date, observedAt)
        : { status: "unavailable" as const, observedAt };
    logInfo("master_sheet.native.load", {
      status: state.status,
      authorizationMs,
      authMs: timings.auth ?? null,
      metadataMs: timings.metadata ?? null,
      tabReadMs: timings.tab_read ?? null,
      parseMs: timings.parse ?? null,
      projectionMs: Math.round(performance.now() - projectionStarted),
      responseBytes: JSON.stringify(state).length,
      totalMs: Math.round(performance.now() - started),
    });
    return state;
  } catch {
    logInfo("master_sheet.native.load", {
      status: "unavailable",
      totalMs: Math.round(performance.now() - started),
    });
    return { status: "unavailable", observedAt };
  }
}
