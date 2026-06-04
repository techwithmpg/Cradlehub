"use client";

import { BriefcaseBusiness, Moon, Pencil, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getShiftDisplay,
  getShiftHelper,
  getShiftLabel,
  type ShiftKind,
  type ShiftTimes,
} from "./schedule-rule-builder-utils";

type ShiftDefinitionCardProps = {
  kind: ShiftKind;
  groupId: string;
  times: ShiftTimes;
  compact?: boolean;
  onEditTime?: () => void;
};

const CARD_CLASSES: Record<ShiftKind, string> = {
  opening: "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white",
  closing: "border-blue-100 bg-gradient-to-br from-blue-50 to-white",
  regular: "border-amber-100 bg-gradient-to-br from-amber-50 to-white",
};

const ICON_CLASSES: Record<ShiftKind, string> = {
  opening: "bg-emerald-100 text-emerald-900",
  closing: "bg-blue-100 text-blue-950",
  regular: "bg-amber-100 text-amber-900",
};

function ShiftIcon({ kind }: { kind: ShiftKind }) {
  if (kind === "opening") return <Sun className="size-6" />;
  if (kind === "closing") return <Moon className="size-6" />;
  return <BriefcaseBusiness className="size-6" />;
}

export function ShiftDefinitionCard({
  kind,
  groupId,
  times,
  compact = false,
  onEditTime,
}: ShiftDefinitionCardProps) {
  const display = getShiftDisplay(kind, times);

  return (
    <article
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        CARD_CLASSES[kind],
        compact && "p-4"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("grid size-12 shrink-0 place-items-center rounded-full", ICON_CLASSES[kind])}>
          <ShiftIcon kind={kind} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-stone-950">{getShiftLabel(kind)}</h4>
            {display.isOvernight ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                +1 day
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xl font-black text-stone-950">
            {display.startLabel} - {display.endLabel}
          </div>
          <p className="mt-1 text-xs font-medium text-stone-500">{getShiftHelper(kind, groupId)}</p>
        </div>
        {onEditTime ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="shrink-0 border-emerald-200 bg-white/70 text-emerald-900 hover:bg-emerald-50"
            onClick={onEditTime}
          >
            <Pencil className="size-3" />
            Edit Time
          </Button>
        ) : null}
      </div>
    </article>
  );
}
