import "server-only";

import { parseSheetRows } from "./sheet-parser";
import { businessDateInManila, selectCurrentAndPreviousTabs } from "./sheet-week";
import type { SheetProjection } from "./sheet-types";

export const CRADLE_MAINSHEETS_SPREADSHEET_ID = "1P4NigRpca7OAlDdiN1Ram5W_6m0kjsdcvW0a9FGzoco";

export type SheetReadResult =
  | { status: "available"; current: SheetProjection; previous: SheetProjection }
  | {
      status: "unavailable";
      reason:
        | "AUTH_NOT_CONFIGURED"
        | "AUTH_UNAVAILABLE"
        | "SHEETS_UNAVAILABLE"
        | "INVALID_RESPONSE"
        | "TAB_AMBIGUITY";
      details?: string[];
    };

export interface SheetReader {
  readCurrentAndPrevious(businessDate?: string): Promise<SheetReadResult>;
}

export interface SheetTokenProvider {
  /** Supply a server-side, read-scoped Google OAuth token. Stage 1A does not choose or store credentials. */
  getAccessToken(): Promise<string>;
}

export type SheetReadPhase = "auth" | "metadata" | "tab_read" | "parse";

interface ReaderOptions {
  tokenProvider?: SheetTokenProvider;
  spreadsheetId?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  onTiming?: (phase: SheetReadPhase, milliseconds: number) => void;
}

function sheetTitles(payload: unknown): string[] | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("sheets" in payload) ||
    !Array.isArray(payload.sheets)
  )
    return null;
  const titles: string[] = [];
  for (const sheet of payload.sheets) {
    const title = sheet?.properties?.title;
    if (typeof title !== "string") return null;
    titles.push(title);
  }
  return titles;
}

function sheetValues(payload: unknown): string[][] | null {
  if (!payload || typeof payload !== "object" || !("values" in payload)) return null;
  if (payload.values === undefined) return [];
  if (!Array.isArray(payload.values)) return null;
  const rows: string[][] = [];
  for (const row of payload.values) {
    if (
      !Array.isArray(row) ||
      !row.every((value) => typeof value === "string" || typeof value === "number")
    )
      return null;
    rows.push(row.map(String));
  }
  return rows;
}

/** The only network operations in this boundary are Google Sheets API GET reads. */
export function createGoogleSheetsReader(options: ReaderOptions = {}): SheetReader {
  const spreadsheetId = options.spreadsheetId ?? CRADLE_MAINSHEETS_SPREADSHEET_ID;
  const fetcher = options.fetcher ?? fetch;
  const measure = (phase: SheetReadPhase, started: number) => {
    try {
      options.onTiming?.(phase, Math.round(performance.now() - started));
    } catch {
      /* Observation must not affect reads. */
    }
  };

  return {
    async readCurrentAndPrevious(date?: string): Promise<SheetReadResult> {
      if (!options.tokenProvider) return { status: "unavailable", reason: "AUTH_NOT_CONFIGURED" };
      let token: string;
      const authStarted = performance.now();
      try {
        token = await options.tokenProvider.getAccessToken();
        if (!token) return { status: "unavailable", reason: "AUTH_UNAVAILABLE" };
      } catch {
        return { status: "unavailable", reason: "AUTH_UNAVAILABLE" };
      } finally {
        measure("auth", authStarted);
      }

      const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
      const readJson = async (url: string): Promise<unknown> => {
        const response = await fetcher(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error("Google Sheets read failed");
        return response.json();
      };

      try {
        const metadataStarted = performance.now();
        let metadata: unknown;
        try {
          metadata = await readJson(`${base}?fields=sheets(properties(title))`);
        } finally {
          measure("metadata", metadataStarted);
        }
        const titles = sheetTitles(metadata);
        if (!titles) return { status: "unavailable", reason: "INVALID_RESPONSE" };
        const selection = selectCurrentAndPreviousTabs(
          titles,
          date ?? businessDateInManila((options.now ?? (() => new Date()))())
        );
        if (selection.status === "ambiguous") {
          return { status: "unavailable", reason: "TAB_AMBIGUITY", details: selection.reasons };
        }

        const readTab = async (title: string): Promise<SheetProjection | null> => {
          const range = `'${title.replace(/'/g, "''")}'!A1:AZ`;
          const tabStarted = performance.now();
          let payload: unknown;
          try {
            payload = await readJson(
              `${base}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`
            );
          } finally {
            measure("tab_read", tabStarted);
          }
          const rows = sheetValues(payload);
          if (rows === null) return null;
          const parseStarted = performance.now();
          let projection: SheetProjection;
          try {
            projection = parseSheetRows({ spreadsheetId, sheetName: title, rows });
          } finally {
            measure("parse", parseStarted);
          }
          return projection.classifiedRows.some((row) => row.classification === "HEADER")
            ? projection
            : null;
        };
        const [current, previous] = await Promise.all([
          readTab(selection.current.name),
          readTab(selection.previous.name),
        ]);
        if (!current || !previous) return { status: "unavailable", reason: "INVALID_RESPONSE" };
        return { status: "available", current, previous };
      } catch {
        // Do not return provider errors or response bodies: they may contain credentials or Sheet data.
        return { status: "unavailable", reason: "SHEETS_UNAVAILABLE" };
      }
    },
  };
}
