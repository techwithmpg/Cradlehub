import {
  Bell,
  Eye,
  MoreVertical,
  UserCheck,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DispatchItem, DispatchRole } from "../types";
import { canManageDispatch } from "../types";

export function DispatchActionButton({
  item,
  role,
  onView,
}: {
  item: DispatchItem;
  role: DispatchRole;
  onView?: (item: DispatchItem) => void;
}) {
  const canManage = canManageDispatch(role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Open actions for ${item.number}`}
            className="text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)]"
          >
            <MoreVertical className="size-3.5" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => onView?.(item)} className="cursor-pointer">
          <Eye className="mr-2 size-4" aria-hidden="true" />
          View
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem className="cursor-pointer">
              <UserCheck className="mr-2 size-4" aria-hidden="true" />
              Assign Driver
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <UserRoundCheck className="mr-2 size-4" aria-hidden="true" />
              Assign Therapist
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Bell className="mr-2 size-4" aria-hidden="true" />
              Notify Customer
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
