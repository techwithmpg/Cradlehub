"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CustomizationRow } from "./customization-rows";
import { updateBranchServiceHomeServiceAvailabilityAction } from "@/app/(dashboard)/crm/services/actions";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";

const PAGE_SIZES = [10, 25, 50];

export function ServiceCustomizationTable({
  branchId,
  rows,
  selectedRow,
  onSelect,
  onServicePatch,
}: {
  branchId: string;
  rows: CustomizationRow[];
  selectedRow: CustomizationRow | null;
  onSelect: (row: CustomizationRow | null) => void;
  onServicePatch: (serviceId: string, patch: Partial<ServiceLite>) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] p-8 text-center text-sm text-[var(--cs-text-muted)]">
        No services match your filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-xs font-semibold text-[var(--cs-text-muted)]">
              <th scope="col" className="px-4 py-3">Service</th>
              <th scope="col" className="px-4 py-3">Duration / Price</th>
              <th scope="col" className="px-4 py-3">Category</th>
              <th scope="col" className="px-4 py-3">Providers</th>
              <th scope="col" className="px-4 py-3">Home Service</th>
              <th scope="col" className="px-4 py-3">Coverage / Setup</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <TableRow
                key={row.branchServiceId}
                branchId={branchId}
                row={row}
                isSelected={selectedRow?.branchServiceId === row.branchServiceId}
                onSelect={() => onSelect(row)}
                onServicePatch={onServicePatch}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-xs text-[var(--cs-text-muted)]">
          Showing {start + 1}-{Math.min(start + pageSize, rows.length)} of {rows.length}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="h-8 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs text-[var(--cs-text)]"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="size-8 border-[var(--cs-border)]"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-[var(--cs-text-muted)]">
            Page {safePage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="size-8 border-[var(--cs-border)]"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TableRow({
  branchId,
  row,
  isSelected,
  onSelect,
  onServicePatch,
}: {
  branchId: string;
  row: CustomizationRow;
  isSelected: boolean;
  onSelect: () => void;
  onServicePatch: (serviceId: string, patch: Partial<ServiceLite>) => void;
}) {
  return (
    <tr
      className={[
        "border-b border-[var(--cs-border-soft)] last:border-b-0 cursor-pointer transition",
        isSelected ? "bg-[var(--cs-sand-tint)]" : "bg-[var(--cs-surface)] hover:bg-[var(--cs-surface-warm)]",
      ].join(" ")}
      onClick={onSelect}
    >
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <ServiceThumbnail row={row} />
          <div className="min-w-0">
            <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} aria-label={`View ${row.name}`} className="text-left text-sm font-semibold text-[var(--cs-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs-success-text)]">{row.name}</button>
            <p className="m-0 max-w-[220px] truncate text-xs text-[var(--cs-text-muted)]">{row.description ?? "Service details"}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-[var(--cs-text-secondary)]">{row.duration} min<span className="block text-xs text-[var(--cs-text-muted)]">₱{row.price.toLocaleString()}</span></td>
      <td className="px-4 py-3 align-middle">
        <span className="text-sm text-[var(--cs-text-secondary)]">{row.category ?? "—"}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="text-sm font-medium text-[var(--cs-text)]">{row.providerCount}</span><span className="block text-xs text-[var(--cs-text-muted)]">assigned</span>
      </td>
      <td className="px-4 py-3 align-middle text-center">
        <HomeServiceToggle
          key={`${row.branchServiceId}:${String(row.isHomeService)}`}
          branchId={branchId}
          row={row}
          onServicePatch={onServicePatch}
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${row.providerCount === 0 ? "bg-[var(--cs-error-bg)] text-[var(--cs-error-text)]" : row.providerCount === 1 ? "bg-[var(--cs-warning-bg)] text-[var(--cs-warning-text)]" : "bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]"}`}>{row.providerCount === 0 ? "Needs provider" : row.providerCount === 1 ? "Low coverage" : "Covered"}</span>
        <span className="block pt-1 text-xs text-[var(--cs-text-muted)]">{row.isActive ? row.readinessIssues[0] ?? "Basic setup complete" : "Inactive"}</span>
      </td>
    </tr>
  );
}

function HomeServiceToggle({
  branchId,
  row,
  onServicePatch,
}: {
  branchId: string;
  row: CustomizationRow;
  onServicePatch: (serviceId: string, patch: Partial<ServiceLite>) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(row.isHomeService);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    const previousValue = localValue;
    setErrorMsg(null);
    setLocalValue(checked);
    startTransition(async () => {
      const res = await updateBranchServiceHomeServiceAvailabilityAction({
        branchId,
        serviceId: row.serviceId,
        availableHomeService: checked,
      });
      if (!res.success) {
        const message = res.error ?? "Home Service update failed.";
        setErrorMsg(message);
        setLocalValue(previousValue);
        toast.error("Home Service not saved", { description: message });
        return;
      }
      // Sync local state to what DB actually saved
      setLocalValue(res.savedAvailableHomeService);
      onServicePatch(row.serviceId, {
        available_home_service: res.branchService.available_home_service,
      });
      toast.success("Home Service updated", {
        description: `${row.name} is ${
          res.savedAvailableHomeService ? "available" : "not available"
        } for Home Service.`,
      });
    });
  };

  // Warn if ON but service won't appear publicly
  const showWarning = localValue && (!row.isActive || row.visibility !== "public");
  const hasError = errorMsg !== null;

  return (
    <div
      className="inline-flex flex-col items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      title={
        hasError
          ? errorMsg ?? "Save failed"
          : showWarning
          ? !row.isActive
            ? "Service is inactive — use Delivery Mode to activate"
            : "Service is not public — enable Public Booking for it to appear online"
          : undefined
      }
    >
      <Switch
        aria-label={`Home Service for ${row.name}`}
        checked={localValue}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <span
        className={[
          "text-[0.625rem] font-medium",
          hasError
            ? "text-[var(--cs-error-text)]"
            : showWarning
            ? "text-[var(--cs-warning-text)]"
            : localValue
            ? "text-[var(--cs-success-text)]"
            : "text-[var(--cs-text-muted)]",
        ].join(" ")}
      >
        {isPending ? "…" : hasError ? "ERR" : showWarning ? "⚠ ON" : localValue ? "ON" : "OFF"}
      </span>
    </div>
  );
}

function ServiceThumbnail({ row }: { row: CustomizationRow }) {
  if (row.imageUrl) {
    return (
      <Image
        src={row.imageUrl}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="size-10 shrink-0 rounded-lg border border-[var(--cs-border)] object-cover"
      />
    );
  }
  const initials = row.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-sand-mist)] text-xs font-semibold text-[var(--cs-sand-dark)]">
      {initials || "S"}
    </span>
  );
}
