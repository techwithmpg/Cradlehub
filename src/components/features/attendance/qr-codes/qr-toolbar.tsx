import { ChevronDown, FileArchive, Plus, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
} from "@/components/features/attendance/attendance-ui";
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
  urlActionsDisabled,
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
  urlActionsDisabled: boolean;
}) {
  return (
    <ToolbarShell
      fieldsClassName="sm:grid-cols-[160px_140px_130px_minmax(220px,1fr)]"
      actions={
        <>
          <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={onGenerateMissing}>
            <QrCode data-icon="inline-start" />
            Generate Missing
          </Button>
          <Button type="button" size="lg" disabled={isPending} onClick={onGenerateQr} className="bg-[#0B5634] text-white hover:bg-[#0A482D]">
            <Plus data-icon="inline-start" />
            Generate QR
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={urlActionsDisabled} onClick={onExportSelected}>
            <FileArchive data-icon="inline-start" />
            Export Selected
            <ChevronDown data-icon="inline-end" className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={urlActionsDisabled} onClick={onPrintSelected}>
            <Printer data-icon="inline-start" />
            Print Selected
          </Button>
        </>
      }
    >
      <ToolbarSelect label="Branch" value={branchName} disabled onChange={() => undefined}>
        <option>{branchName}</option>
      </ToolbarSelect>
      <ToolbarSelect
        label="Type"
        value={typeFilter}
        onChange={(value) => onTypeFilterChange(value as QrTypeFilter)}
      >
        <option value="all">All Types</option>
        <option value="attendance">Attendance</option>
        <option value="room">Room</option>
        <option value="resource">Resource</option>
      </ToolbarSelect>
      <ToolbarSelect
        label="Status"
        value={statusFilter}
        onChange={(value) => onStatusFilterChange(value as QrStatusFilter)}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All Statuses</option>
      </ToolbarSelect>
      <ToolbarSearch
        label="Search"
        value={query}
        onChange={onQueryChange}
        placeholder="Search QR points..."
      />
    </ToolbarShell>
  );
}
