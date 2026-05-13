import { Bell, Eye, UserCheck, UserRoundCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DispatchItem, DispatchRole } from "../types";
import { canManageDispatch, isReadOnlyRole } from "../types";

function formatEta(item: DispatchItem) {
  return typeof item.etaMinutes === "number" ? `${item.etaMinutes} min` : "-";
}

function formatPaymentStatus(status: DispatchItem["paymentStatus"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium leading-4 text-[var(--cs-text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold leading-5 text-[var(--cs-text)]">
        {value || "-"}
      </div>
    </div>
  );
}

export function DispatchDetailsPanel({
  item,
  role,
  title,
  className,
  onClose,
}: {
  item: DispatchItem;
  role: DispatchRole;
  title?: string;
  className?: string;
  onClose?: () => void;
}) {
  const canManage = canManageDispatch(role);
  const readOnly = isReadOnlyRole(role);

  return (
    <Card
      className={cn(
        "h-fit rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0",
        className
      )}
    >
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-3 py-3">
        <CardTitle className="text-sm font-bold text-[var(--cs-text)]">
          {title ?? `Dispatch ${item.number}`}
        </CardTitle>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close selected dispatch details"
            className="text-[var(--cs-text-muted)]"
            onClick={onClose}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-3 py-3">
        <div className="space-y-3">
          <DetailField label="Customer" value={item.customerName} />
          <DetailField label="Service" value={item.serviceName} />
          <DetailField label="Area" value={item.area} />
          <DetailField label="ETA" value={formatEta(item)} />
          <DetailField label="Driver" value={item.driverName ?? "-"} />
          <DetailField label="Therapist" value={item.therapistName ?? "-"} />
          <DetailField label="Payment" value={formatPaymentStatus(item.paymentStatus)} />
        </div>

        {canManage ? (
          <div className="space-y-2 pt-1">
            <Button className="h-8 w-full bg-[#6d28d9] text-xs text-white hover:bg-[#5b21b6]">
              <UserCheck className="size-3.5" aria-hidden="true" />
              Assign Driver
            </Button>
            <Button variant="outline" className="h-8 w-full text-xs text-[#6d28d9]">
              <UserRoundCheck className="size-3.5" aria-hidden="true" />
              Assign Therapist
            </Button>
            <Button variant="outline" className="h-8 w-full text-xs text-[#6d28d9]">
              <Bell className="size-3.5" aria-hidden="true" />
              Notify Customer
            </Button>
          </div>
        ) : readOnly ? (
          <Button variant="outline" className="h-8 w-full text-xs text-[#6d28d9]">
            <Eye className="size-3.5" aria-hidden="true" />
            View Details
          </Button>
        ) : role === "driver" ? (
          <Button variant="outline" className="h-8 w-full text-xs text-[#6d28d9]">
            <Eye className="size-3.5" aria-hidden="true" />
            Open Trip
          </Button>
        ) : (
          <Button variant="outline" className="h-8 w-full text-xs text-[#6d28d9]">
            <Eye className="size-3.5" aria-hidden="true" />
            Update Service Status
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
