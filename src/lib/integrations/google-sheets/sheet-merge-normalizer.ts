import type { GoogleSheetCell, GoogleSheetMergeRange } from "./sheet-reader";

export type MergeRestorationTarget = {
  sourceRow: number;
  sourceColumn: number;
};

export type MergeRestoration = {
  sourceRow: number;
  sourceColumn: number;
  ownerRow: number;
  ownerColumn: number;
  value: GoogleSheetCell;
};

export type MergeNormalizationResult = {
  values: GoogleSheetCell[][];
  restorations: MergeRestoration[];
};

function isBlank(value: GoogleSheetCell | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

/**
 * Restores only explicitly requested cells when
 * Google Sheet merge metadata proves the cell is
 * a child of a populated single-column merge.
 *
 * Raw values are never mutated.
 * No adjacent-row inheritance is performed.
 */
export function restoreMergedIdentityCells(input: {
  values: GoogleSheetCell[][];
  merges: GoogleSheetMergeRange[];
  targets: readonly MergeRestorationTarget[];
  startRow?: number;
  startColumn?: number;
}): MergeNormalizationResult {
  const startRow = input.startRow ?? 1;

  const startColumn = input.startColumn ?? 1;

  const values = input.values.map((row) => [...row]);

  const restorations: MergeRestoration[] = [];

  const targetKeys = new Set(
    input.targets.map((target) => cellKey(target.sourceRow, target.sourceColumn))
  );

  if (values.length === 0 || targetKeys.size === 0) {
    return {
      values,
      restorations,
    };
  }

  for (const merge of input.merges) {
    if (merge.startColumn !== merge.endColumn) {
      continue;
    }

    const column = merge.startColumn;

    const ownerRow = merge.startRow;

    const ownerColumn = merge.startColumn;

    const ownerLocalRow = ownerRow - startRow;

    const ownerLocalColumn = ownerColumn - startColumn;

    if (ownerLocalRow < 0 || ownerLocalRow >= values.length || ownerLocalColumn < 0) {
      continue;
    }

    const ownerValue = values[ownerLocalRow]?.[ownerLocalColumn];

    if (isBlank(ownerValue)) {
      continue;
    }

    for (let sourceRow = merge.startRow + 1; sourceRow <= merge.endRow; sourceRow += 1) {
      if (!targetKeys.has(cellKey(sourceRow, column))) {
        continue;
      }

      const localRow = sourceRow - startRow;

      const localColumn = column - startColumn;

      if (localRow < 0 || localRow >= values.length || localColumn < 0) {
        continue;
      }

      const row = values[localRow];

      if (!row) {
        continue;
      }

      if (!isBlank(row[localColumn])) {
        continue;
      }

      while (row.length <= localColumn) {
        row.push(null);
      }

      row[localColumn] = ownerValue ?? null;

      restorations.push({
        sourceRow,
        sourceColumn: column,
        ownerRow,
        ownerColumn,
        value: ownerValue ?? null,
      });
    }
  }

  return {
    values,
    restorations,
  };
}
