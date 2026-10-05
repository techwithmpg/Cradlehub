import "server-only";

import { CRADLE_MAINSHEETS_SPREADSHEET_ID } from "./sheet-reader";

export type WorkbookSource = {
  workbookId: string;
  workbookLabel: string;
  branchId: string;
  label: string;
  enabled: true;
  decisionStatus: "PROVISIONAL";
};

export type ActiveBranch = { id: string; name: string };

// Owner-approved project mapping, not a branch assertion found in the Sheet.
// Resolve the active branch record at request time; do not rely on seed UUIDs.
export type WorkbookSourceConfiguration = {
  workbookId: string;
  workbookLabel?: string;
  branchLabel: string;
  enabled: boolean;
  decisionStatus: "PROVISIONAL";
};

const SOURCES: readonly WorkbookSourceConfiguration[] = [
  {
    workbookId: CRADLE_MAINSHEETS_SPREADSHEET_ID,
    workbookLabel: "CRADLE MAINSHEETS",
    branchLabel: "Main Branch",
    enabled: true,
    decisionStatus: "PROVISIONAL" as const,
  },
] as const;

export function resolveConfiguredWorkbookSources(
  activeBranches: readonly ActiveBranch[],
  configurations: readonly WorkbookSourceConfiguration[] = SOURCES
): WorkbookSource[] {
  return configurations.flatMap((configuration) => {
    const source = resolveWorkbookSource(configuration.workbookId, activeBranches, configurations);
    return source ? [source] : [];
  });
}

function normalizeBranchName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesConfiguredBranch(name: string, label: string): boolean {
  const normalized = normalizeBranchName(name);
  const configured = normalizeBranchName(label);
  if (configured !== "main branch") {
    return normalized === configured || normalized.endsWith(` ${configured}`);
  }
  return (
    normalized === "main" ||
    normalized === "main spa" ||
    normalized.endsWith(" main spa") ||
    normalized === "main branch" ||
    normalized.endsWith(" main branch")
  );
}

/** Unknown, disabled, duplicate, or inconsistent sources fail closed. */
export function resolveWorkbookSource(
  workbookId: string,
  activeBranches: readonly ActiveBranch[],
  configurations: readonly WorkbookSourceConfiguration[] = SOURCES
): WorkbookSource | null {
  const configured = configurations.filter((source) => source.workbookId === workbookId);
  const configuration = configured[0];
  if (configured.length !== 1 || !configuration?.enabled) return null;
  const matchingBranches = activeBranches.filter((candidate) =>
    matchesConfiguredBranch(candidate.name, configuration.branchLabel)
  );
  const branch = matchingBranches[0];
  if (matchingBranches.length !== 1 || !branch) return null;
  return {
    workbookId,
    workbookLabel: configuration.workbookLabel ?? workbookId,
    branchId: branch.id,
    label: configuration.branchLabel,
    enabled: true,
    decisionStatus: configuration.decisionStatus,
  };
}
