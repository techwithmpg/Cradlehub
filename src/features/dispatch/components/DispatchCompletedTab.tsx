import { CheckCircle2, Clock3, Star, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  completedDispatchItems,
  completedStats,
} from "../data/mockDispatchData";
import { DispatchStatsCards } from "./DispatchStatsCards";

const completedStatIcons = [
  <CheckCircle2 key="completed" className="size-4" aria-hidden="true" />,
  <XCircle key="cancelled" className="size-4" aria-hidden="true" />,
  <Clock3 key="on-time" className="size-4" aria-hidden="true" />,
  <Star key="rating" className="size-4" aria-hidden="true" />,
];

export function DispatchCompletedTab() {
  return (
    <div className="space-y-3">
      <DispatchStatsCards
        stats={completedStats.map((stat, index) => ({
          ...stat,
          icon: completedStatIcons[index],
        }))}
      />

      <Card className="rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0">
        <CardContent className="p-0">
          <Table className="min-w-[760px] text-xs">
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
                  Completed At
                </TableHead>
                <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                  Driver
                </TableHead>
                <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                  Therapist
                </TableHead>
                <TableHead className="h-10 px-3 text-[11px] font-bold text-[var(--cs-text)]">
                  Rating
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedDispatchItems.map((item) => (
                <TableRow key={item.id} className="border-[var(--cs-border-soft)]">
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
                    {item.completedAt}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                    {item.driverName ?? "-"}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-[var(--cs-text-secondary)]">
                    {item.therapistName ?? "-"}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-[#16a34a]">
                      {item.rating}
                      <Star className="size-3 fill-current" aria-hidden="true" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
