"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CustomizationRow } from "./customization-rows";
import type { DeliveryMode } from "./service-customization-tab";
import { updateBranchServiceHomeServiceAvailabilityAction } from "@/app/(dashboard)/crm/services/actions";

const PAGE_SIZES = [10, 25, 50];

export function ServiceCustomizationTable({
  branchId,
  rows,
  selectedRow,
  onSelect,
}: {
  branchId: string;
  rows: CustomizationRow[];
  selectedRow: CustomizationRow | null;
  onSelect: (row: CustomizationRow | null) => void;
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
      <div className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-xs font-semibold text-[var(--cs-text-muted)]">
              <th className="w-[28%] px-4 py-3">Service</th>
              <th className="w-[14%] px-4 py-3">Category</th>
              <th className="w-[12%] px-4 py-3">Delivery</th>
              <th className="w-[12%] px-4 py-3 text-center">Home Service</th>
              <th className="w-[12%] px-4 py-3">Public Status</th>
              <th className="w-[14%] px-4 py-3">Readiness</th>
              <th className="w-[8%] px-4 py-3 text-right">Actions</th>
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
}: {
  branchId: string;
  row: CustomizationRow;
  isSelected: boolean;
  onSelect: () => void;
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
            <p className="m-0 text-sm font-semibold text-[var(--cs-text)] truncate">{row.name}</p>
            <p className="m-0 text-xs text-[var(--cs-text-muted)]">
              {row.duration} min · ₱{row.price.toLocaleString()}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="text-sm text-[var(--cs-text-secondary)]">{row.category ?? "—"}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <DeliveryModeBadge mode={row.deliveryMode} />
      </td>
      <td className="px-4 py-3 align-middle text-center">
        <HomeServiceToggle
          key={`${row.branchServiceId}:${String(row.isHomeService)}`}
          branchId={branchId}
          row={row}
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <PublicStatusBadge row={row} />
      </td>
      <td className="px-4 py-3 align-middle">
        <ReadinessBadge row={row} />
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="size-8 text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
        >
          <Pencil className="size-4" />
        </Button>
      </td>
    </tr>
  );
}

function HomeServiceToggle({ branchId, row }: { branchId: string; row: CustomizationRow }) {
  const router = useRouter();
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
      toast.success("Home Service updated", {
        description: `${row.name} is ${
          res.savedAvailableHomeService ? "available" : "not available"
        } for Home Service.`,
      });
      // Refresh server data so page re-renders with accurate state
      router.refresh();
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

function DeliveryModeBadge({ mode }: { mode: DeliveryMode }) {
  const config: Record<DeliveryMode, { label: string; color: string; bg: string }> = {
    in_spa: { label: "In-Spa", color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    home_service: { label: "Home-Service", color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
    both: { label: "Both", color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    hidden: { label: "Hidden", color: "var(--cs-text-muted)", bg: "var(--cs-surface-warm)" },
  };
  const c = config[mode];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

function PublicStatusBadge({ row }: { row: CustomizationRow }) {
  if (!row.isActive) {
    return (
      <span className="inline-flex items-center rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs font-medium text-[var(--cs-text-muted)]">
        Inactive
      </span>
    );
  }
  if (row.visibility === "public") {
    return (
      <span className="inline-flex items-center rounded-md border border-[#CFE4D5] bg-[var(--cs-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--cs-success-text)]">
        Public
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs font-medium text-[var(--cs-text-muted)]">
      {row.visibility === "csr_only" ? "CSR Only" : row.visibility}
    </span>
  );
}

function ReadinessBadge({ row }: { row: CustomizationRow }) {
  if (!row.isActive) {
    return (
      <span className="inline-flex items-center rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs font-medium text-[var(--cs-text-muted)]">
        Hidden
      </span>
    );
  }
  if (row.isReady) {
    return (
      <span className="inline-flex items-center rounded-md border border-[#CFE4D5] bg-[var(--cs-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--cs-success-text)]">
        Ready
      </span>
    );
  }
  const issue = row.readinessIssues[0] ?? "Needs setup";
  return (
    <span className="inline-flex items-center rounded-md border border-[#E7D9B8] bg-[var(--cs-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--cs-warning-text)]">
      {issue}
    </span>
  );
}
