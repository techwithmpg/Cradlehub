import {
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { queueStats } from "../data/mockDispatchData";
import type { DispatchItem, DispatchRole } from "../types";
import { DispatchActionButton } from "./DispatchActionButton";
import { DispatchDetailsPanel } from "./DispatchDetailsPanel";
import { DispatchStatsCards } from "./DispatchStatsCards";
import { DispatchStatusBadge } from "./DispatchStatusBadge";

const queueStatIcons = [
  <CalendarDays key="calendar" className="size-4" aria-hidden="true" />,
  <Clock3 key="clock" className="size-4" aria-hidden="true" />,
  <Car key="car" className="size-4" aria-hidden="true" />,
  <CheckCircle2 key="check" className="size-4" aria-hidden="true" />,
];

function formatEta(item: DispatchItem) {
  return typeof item.etaMinutes === "number" ? `${item.etaMinutes} min` : "-";
}

export function DispatchQueueTab({
  role,
  items,
  selectedItem,
  onSelect,
}: {
  role: DispatchRole;
  items: DispatchItem[];
  selectedItem: DispatchItem;
  onSelect: (item: DispatchItem) => void;
}) {
  return (
    <div className="space-y-3">
      <DispatchStatsCards
        stats={queueStats.map((stat, index) => ({
          ...stat,
          icon: queueStatIcons[index],
        }))}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0">
          <CardContent className="p-0">
            <Table className="min-w-[820px] text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Dispatch #
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Customer
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Service
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Driver
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Therapist
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    Status
                  </TableHead>
                  <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                    ETA
                  </TableHead>
                  <TableHead className="h-10 px-3 text-right text-[11px] font-bold text-[var(--cs-text)]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const selected = item.id === selectedItem.id;

                  return (
                    <TableRow
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(item);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-[var(--cs-border-soft)]",
                        selected && "bg-[#f5f3ff] hover:bg-[#f5f3ff]"
                      )}
                    >
                      <TableCell className="px-3 py-3 font-bold text-[var(--cs-text)]">
                        {item.number}
                      </TableCell>
                      <TableCell className="px-3 py-3 font-semibold text-[var(--cs-text)]">
                        {item.customerName}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                        {item.serviceName}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                        {item.driverName ?? "-"}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                        {item.therapistName ?? "-"}
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <DispatchStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                        {formatEta(item)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right">
                        <DispatchActionButton item={item} role={role} onView={onSelect} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DispatchDetailsPanel
          item={selectedItem}
          role={role}
          title={`Dispatch ${selectedItem.number}`}
        />
      </div>
    </div>
  );
}
