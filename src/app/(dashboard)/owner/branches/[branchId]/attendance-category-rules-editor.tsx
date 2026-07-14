"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BranchAttendanceCategoryRule } from "@/lib/attendance/branch-attendance-rules";
import type { AttendanceStaffCategory } from "@/lib/attendance/closing-policy";
import { saveAttendanceCategoryRuleAction } from "./attendance-rule-actions";

type TriState = "inherit" | "yes" | "no";

const BOOLEAN_OPTIONS = [
  { label: "Inherit branch", value: "inherit" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
] as const;

function toInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toTriState(value: boolean | null): TriState {
  return value === null ? "inherit" : value ? "yes" : "no";
}

function fromTriState(value: TriState): boolean | null {
  return value === "inherit" ? null : value === "yes";
}

function valueBadge(value: number | boolean | null, fallback: string) {
  return value === null ? (
    <Badge variant="outline">Inherits {fallback}</Badge>
  ) : (
    <Badge variant="secondary">{typeof value === "boolean" ? (value ? "Yes" : "No") : value}</Badge>
  );
}

function hasOverride(rule: BranchAttendanceCategoryRule): boolean {
  return Object.values(rule.override).some((value) => value !== null);
}

export function AttendanceCategoryRulesEditor({
  branchId,
  categories,
}: {
  branchId: string;
  categories: BranchAttendanceCategoryRule[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const categoryItems = useMemo(
    () => categories.map((row) => ({ label: row.label, value: row.category })),
    [categories]
  );
  const [selectedCategory, setSelectedCategory] = useState<AttendanceStaffCategory>(
    categories[0]?.category ?? "crm_front_desk"
  );
  const selected =
    categories.find((row) => row.category === selectedCategory) ?? categories[0];
  const [lateGrace, setLateGrace] = useState(() => toInput(selected?.override.late_grace_minutes ?? null));
  const [earlyLeave, setEarlyLeave] = useState(() =>
    toInput(selected?.override.early_leave_threshold_minutes ?? null)
  );
  const [overtime, setOvertime] = useState(() =>
    toInput(selected?.override.overtime_threshold_minutes ?? null)
  );
  const [activeService, setActiveService] = useState<TriState>(() =>
    toTriState(selected?.override.active_service_blocks_clock_out ?? null)
  );
  const [closingPolicy, setClosingPolicy] = useState<TriState>(() =>
    toTriState(selected?.override.crm_closing_policy_enabled ?? null)
  );
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("Category attendance rule update");

  function chooseCategory(category: AttendanceStaffCategory) {
    const next = categories.find((row) => row.category === category);
    if (!next) return;
    setSelectedCategory(category);
    setLateGrace(toInput(next.override.late_grace_minutes));
    setEarlyLeave(toInput(next.override.early_leave_threshold_minutes));
    setOvertime(toInput(next.override.overtime_threshold_minutes));
    setActiveService(toTriState(next.override.active_service_blocks_clock_out));
    setClosingPolicy(toTriState(next.override.crm_closing_policy_enabled));
  }

  function submit() {
    startTransition(async () => {
      const result = await saveAttendanceCategoryRuleAction({
        branchId,
        category: selectedCategory,
        lateGraceMinutes: toNumber(lateGrace),
        earlyLeaveThresholdMinutes: toNumber(earlyLeave),
        overtimeThresholdMinutes: toNumber(overtime),
        activeServiceBlocksClockOut: fromTriState(activeService),
        crmClosingPolicyEnabled: fromTriState(closingPolicy),
        effectiveDate: effectiveDate || null,
        reason,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Late grace</TableHead>
            <TableHead>Early threshold</TableHead>
            <TableHead>Overtime threshold</TableHead>
            <TableHead>Closing rule</TableHead>
            <TableHead>Override status</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((row) => (
            <TableRow key={row.category}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell>{valueBadge(row.override.late_grace_minutes, `${row.resolved.lateGraceMinutes}m`)}</TableCell>
              <TableCell>{valueBadge(row.override.early_leave_threshold_minutes, `${row.resolved.earlyLeaveThresholdMinutes}m`)}</TableCell>
              <TableCell>{valueBadge(row.override.overtime_threshold_minutes, `${row.resolved.overtimeThresholdMinutes}m`)}</TableCell>
              <TableCell>
                {row.category === "crm_front_desk" && row.resolved.crmClosingPolicyEnabled
                  ? "Branch closing window"
                  : "Assigned schedule"}
              </TableCell>
              <TableCell>
                <Badge variant={hasOverride(row) ? "secondary" : "outline"}>
                  {hasOverride(row) ? "Override" : "Branch default"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${row.label}`}
                  onClick={() => chooseCategory(row.category)}
                >
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="rounded-lg border p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2 md:col-span-3">
            <Label htmlFor="attendance-category">Edit category</Label>
            <Select
              items={categoryItems}
              value={selectedCategory}
              onValueChange={(value) => chooseCategory(value as AttendanceStaffCategory)}
            >
              <SelectTrigger id="attendance-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {[
            ["category-late", "Late grace (minutes)", lateGrace, setLateGrace],
            ["category-early", "Early leave threshold", earlyLeave, setEarlyLeave],
            ["category-overtime", "Overtime threshold", overtime, setOvertime],
          ].map(([id, label, value, setter]) => (
            <div className="grid gap-2" key={id as string}>
              <Label htmlFor={id as string}>{label as string}</Label>
              <Input
                id={id as string}
                type="number"
                min={0}
                max={240}
                placeholder="Inherit"
                value={value as string}
                onChange={(event) => (setter as (value: string) => void)(event.target.value)}
              />
            </div>
          ))}

          <TriStateSelect
            id="category-active-service"
            label="Active service blocks clock-out"
            value={activeService}
            onChange={setActiveService}
          />
          {selectedCategory === "crm_front_desk" ? (
            <TriStateSelect
              id="category-closing-policy"
              label="CRM closing policy"
              value={closingPolicy}
              onChange={setClosingPolicy}
            />
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="category-effective-date">Effective date</Label>
            <Input
              id="category-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2 md:col-span-3">
            <Label htmlFor="category-change-reason">Change reason</Label>
            <Input
              id="category-change-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={submit} disabled={isPending}>
            <Save data-icon="inline-start" />
            {isPending ? "Saving..." : "Save category override"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TriStateSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: TriState;
  onChange: (value: TriState) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={BOOLEAN_OPTIONS}
        value={value}
        onValueChange={(next) => onChange(next as TriState)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {BOOLEAN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
