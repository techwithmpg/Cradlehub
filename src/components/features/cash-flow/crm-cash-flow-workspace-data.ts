import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";
import type { FinancialEntryMode } from "./record-financial-entry-modal";

export type CrmCashFlowTab = "today" | "ledger" | "day-close" | "history";

export type CrmCashFlowRequest = {
  date?: string;
  search?: string;
  category?: string;
  method?: string;
  status?: string;
  page?: number;
};

export type CrmCashFlowWorkspacePayload = {
  data: CashFlowWorkspaceData;
  request: CrmCashFlowRequest;
};

export function normalizeCrmCashFlowTab(
  value: string | string[] | null | undefined
): CrmCashFlowTab {
  return value === "ledger" || value === "day-close" || value === "history"
    ? value
    : "today";
}

export function normalizeCrmCashFlowEntryMode(
  value: string | string[] | null | undefined
): FinancialEntryMode | null {
  if (value === "payment") return "customer_payment";
  if (value === "expense") return "expense";
  if (value === "cash-operations") return "other_entry";
  return null;
}

function isValidBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normalizeText(
  value: string | string[] | null | undefined,
  maxLength = 120
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function normalizeCrmCashFlowRequest(
  input: {
    date?: string | string[] | null;
    search?: string | string[] | null;
    category?: string | string[] | null;
    method?: string | string[] | null;
    status?: string | string[] | null;
    page?: string | number | string[] | null;
  },
  fallbackBusinessDate: string
): CrmCashFlowRequest {
  const requestedDate =
    typeof input.date === "string" &&
    isValidBusinessDate(input.date)
      ? input.date
      : fallbackBusinessDate;

  const parsedPage =
    typeof input.page === "number"
      ? input.page
      : typeof input.page === "string"
        ? Number.parseInt(input.page, 10)
        : 1;

  return {
    date: requestedDate,
    search: normalizeText(input.search),
    category: normalizeText(input.category, 60),
    method: normalizeText(input.method, 60),
    status: normalizeText(input.status, 60),
    page:
      Number.isFinite(parsedPage) && parsedPage >= 1
        ? Math.floor(parsedPage)
        : 1,
  };
}

export function crmCashFlowRequestKey(
  request: CrmCashFlowRequest
): string {
  const params = new URLSearchParams();
  if (request.date) params.set("date", request.date);
  if (request.search) params.set("search", request.search);
  if (request.category) params.set("category", request.category);
  if (request.method) params.set("method", request.method);
  if (request.status) params.set("status", request.status);
  if (request.page && request.page > 1)
    params.set("page", String(request.page));

  const query = params.toString();
  return query ? `/crm/cash-flow?${query}` : "/crm/cash-flow";
}
