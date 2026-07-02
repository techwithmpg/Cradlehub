import { ChevronDown, FileArchive, Plus, Printer, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import type { QrPointType } from "@/lib/attendance/types";

export type QrTypeFilter = "all" | QrPointType;
export type QrStatusFilter = "active" | "inactive" | "all";

export function QrToolbar({
  branchName,
  query,
  typeFilter,
  statusFilter,
  isPending,
  onQueryChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onGenerateMissing,
  onGenerateQr,
  onExportSelected,
  onPrintSelected,
}: {
  branchName: string;
  query: string;
  typeFilter: QrTypeFilter;
  statusFilter: QrStatusFilter;
  isPending: boolean;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (value: QrTypeFilter) => void;
  onStatusFilterChange: (value: QrStatusFilter) => void;
  onGenerateMissing: () => void;
  onGenerateQr: () => void;
  onExportSelected: () => void;
  onPrintSelected: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[160px_140px_130px_minmax(220px,1fr)]">
        <ToolbarSelect label="Branch" value={branchName} onChange={() => undefined}>
          <option>{branchName}</option>
        </ToolbarSelect>
        <ToolbarSelect label="Type" value={typeFilter} onChange={(value) => onTypeFilterChange(value as QrTypeFilter)}>
          <option value="all">All Types</option>
          <option value="attendance">Attendance</option>
          <option value="room">Room</option>
          <option value="resource">Resource</option>
        </ToolbarSelect>
        <ToolbarSelect label="Status" value={statusFilter} onChange={(value) => onStatusFilterChange(value as QrStatusFilter)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All Statuses</option>
        </ToolbarSelect>
        <label className="grid min-w-0 gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Search</span>
          <span className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 shadow-sm">
            <Search className="size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search QR points..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onGenerateMissing}>
          <QrCode data-icon="inline-start" />
          Generate Missing
        </Button>
        <Button type="button" size="lg" disabled={isPending} onClick={onGenerateQr} className="bg-[#0B5634] text-white hover:bg-[#0A482D]">
          <Plus data-icon="inline-start" />
          Generate QR
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onExportSelected}>
          <FileArchive data-icon="inline-start" />
          Export Selected
          <ChevronDown data-icon="inline-end" className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onPrintSelected}>
          <Printer data-icon="inline-start" />
          Print Selected
        </Button>
      </div>
    </div>
  );
}

function ToolbarSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm font-semibold shadow-sm">
        {children}
      </select>
    </label>
  );
}
