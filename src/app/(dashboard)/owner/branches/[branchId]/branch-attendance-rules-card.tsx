"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock3, Save, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AttendanceRuleHistoryItem,
  BranchAttendanceRulesData,
} from "@/lib/attendance/branch-attendance-rules";
import {
  ATTENDANCE_STAFF_CATEGORY_LABELS,
  deriveAttendanceClosingTimeline,
} from "@/lib/attendance/closing-policy";
import { AttendanceCategoryRulesEditor } from "./attendance-category-rules-editor";
import { saveBranchAttendanceRulesAction } from "./attendance-rule-actions";

function timeValue(value: string): string {
  return value.slice(0, 5);
}

function formatPolicyTime(value: string | null, timezone: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Check timezone";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not observed yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function historyValueSummary(
  item: AttendanceRuleHistoryItem,
  side: "previous" | "new"
): string {
  const next =
    item.newValues && typeof item.newValues === "object" && !Array.isArray(item.newValues)
      ? item.newValues
      : {};
  const previous =
    item.previousValues &&
    typeof item.previousValues === "object" &&
    !Array.isArray(item.previousValues)
      ? item.previousValues
      : {};
  const keys = Object.keys(next).filter(
    (key) => JSON.stringify(next[key]) !== JSON.stringify(previous[key])
  );
  const source = side === "new" ? next : previous;
  if (keys.length === 0) return "—";
  const visible = keys.slice(0, 3).map((key) => {
    const value = source[key];
    const label = key.replaceAll("_", " ");
    if (value === null || value === undefined || value === "") return `${label}: inherit`;
    return `${label}: ${String(value)}`;
  });
  return `${visible.join(" · ")}${keys.length > visible.length ? ` · +${keys.length - visible.length}` : ""}`;
}

export function BranchAttendanceRulesCard({
  branchId,
  data,
}: {
  branchId: string;
  data: BranchAttendanceRulesData;
}) {
  const [workspaceData, setWorkspaceData] = useState(data);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("closing");
  const [timezone, setTimezone] = useState(data.settings.timezone);
  const [dayBoundary, setDayBoundary] = useState(timeValue(data.settings.attendance_day_boundary));
  const [lateGrace, setLateGrace] = useState(data.settings.late_grace_minutes);
  const [earlyLeave, setEarlyLeave] = useState(data.settings.early_leave_threshold_minutes);
  const [overtime, setOvertime] = useState(data.settings.overtime_threshold_minutes);
  const [duplicateWindow, setDuplicateWindow] = useState(data.settings.duplicate_scan_window_seconds);
  const [activeServiceBlocks, setActiveServiceBlocks] = useState(
    data.settings.active_service_blocks_clock_out
  );
  const [closingPolicyEnabled, setClosingPolicyEnabled] = useState(
    data.settings.crm_closing_policy_enabled
  );
  const [branchClose, setBranchClose] = useState(
    timeValue(data.settings.branch_operating_close_time)
  );
  const [normalBuffer, setNormalBuffer] = useState(data.settings.crm_closing_buffer_minutes);
  const [escalationDelay, setEscalationDelay] = useState(
    data.settings.crm_manager_escalation_delay_minutes
  );
  const [hardCutoffDelay, setHardCutoffDelay] = useState(
    data.settings.crm_hard_cutoff_delay_minutes
  );
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("Branch Attendance policy update");

  function save() {
    startTransition(async () => {
      const result = await saveBranchAttendanceRulesAction({
        branchId,
        timezone,
        attendanceDayBoundary: dayBoundary,
        lateGraceMinutes: lateGrace,
        earlyLeaveThresholdMinutes: earlyLeave,
        overtimeThresholdMinutes: overtime,
        duplicateScanWindowSeconds: duplicateWindow,
        activeServiceBlocksClockOut: activeServiceBlocks,
        branchOperatingCloseTime: branchClose,
        crmClosingPolicyEnabled: closingPolicyEnabled,
        crmClosingBufferMinutes: normalBuffer,
        crmManagerEscalationDelayMinutes: escalationDelay,
        crmHardCutoffDelayMinutes: hardCutoffDelay,
        effectiveDate: effectiveDate || null,
        reason,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setWorkspaceData(result.data);
    });
  }

  const preview = useMemo(() => {
    try {
      return deriveAttendanceClosingTimeline({
        businessDate: workspaceData.previewBusinessDate,
        timezone,
        branchCloseTime: branchClose,
        normalBufferMinutes: normalBuffer,
        managerEscalationDelayMinutes: escalationDelay,
        hardCutoffDelayMinutes: hardCutoffDelay,
      });
    } catch {
      return null;
    }
  }, [
    branchClose,
    workspaceData.previewBusinessDate,
    escalationDelay,
    hardCutoffDelay,
    normalBuffer,
    timezone,
  ]);
  const schedulerLabel = workspaceData.scheduler.recentlyObserved
    ? "Recently running"
    : "Configured in source · deployment unverified";

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Attendance Rules</CardTitle>
        <CardDescription>
          Branch timing, effective-dated category overrides, and the CRM closing-shift intervention policy.
        </CardDescription>
        <CardAction>
          <Badge variant={workspaceData.scheduler.recentlyObserved ? "secondary" : "outline"}>
            {schedulerLabel}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="closing">Branch & closing</TabsTrigger>
            <TabsTrigger value="categories">Category overrides</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="closing" className="mt-4 flex flex-col gap-5">
            <Alert>
              <ShieldCheck />
              <AlertTitle>Raw schedules remain unchanged</AlertTitle>
              <AlertDescription>
                Physical branch closing time is used for CRM closing attendance. Only CRM / front-desk staff on a Closing shift use the operational window below. A schedule such as 5:00 PM–1:30 AM remains stored exactly as assigned.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-4">
              <RuleField label="Timezone" htmlFor="attendance-timezone">
                <Input id="attendance-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              </RuleField>
              <RuleField label="Attendance day boundary" htmlFor="attendance-boundary">
                <Input id="attendance-boundary" type="time" value={dayBoundary} onChange={(event) => setDayBoundary(event.target.value)} />
              </RuleField>
              <NumberField id="attendance-late" label="Late grace (minutes)" value={lateGrace} onChange={setLateGrace} min={0} max={240} />
              <NumberField id="attendance-duplicate" label="Duplicate window (seconds)" value={duplicateWindow} onChange={setDuplicateWindow} min={10} max={600} />
              <NumberField id="attendance-early" label="Early leave threshold" value={earlyLeave} onChange={setEarlyLeave} min={0} max={240} />
              <NumberField id="attendance-overtime" label="Overtime threshold" value={overtime} onChange={setOvertime} min={0} max={240} />
              <SwitchField id="attendance-active-service" label="Active service blocks clock-out" checked={activeServiceBlocks} onChange={setActiveServiceBlocks} />
              <SwitchField id="attendance-closing-enabled" label="Enable CRM closing policy" checked={closingPolicyEnabled} onChange={setClosingPolicyEnabled} />
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 />
                <div>
                  <div className="font-medium">CRM closing timeline</div>
                  <div className="text-sm text-muted-foreground">
                    Reminder, manager escalation, and provisional auto-close are derived from branch time.
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <RuleField label="Branch closes" htmlFor="attendance-branch-close">
                  <Input id="attendance-branch-close" type="time" value={branchClose} onChange={(event) => setBranchClose(event.target.value)} />
                </RuleField>
                <NumberField id="attendance-normal-buffer" label="Normal buffer (minutes)" value={normalBuffer} onChange={setNormalBuffer} min={0} max={240} />
                <NumberField id="attendance-escalation-delay" label="Manager escalation after reminder" value={escalationDelay} onChange={setEscalationDelay} min={1} max={240} />
                <NumberField id="attendance-hard-cutoff" label="Hard cutoff after reminder" value={hardCutoffDelay} onChange={setHardCutoffDelay} min={1} max={360} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <PreviewItem label="Earliest normal" value={formatPolicyTime(preview?.earliestNormalClockOutAt ?? workspaceData.closingPreview.earliestNormalClockOutAt, timezone)} />
                <PreviewItem label="Latest normal / reminder" value={formatPolicyTime(preview?.reminderAt ?? workspaceData.closingPreview.reminderAt, timezone)} />
                <PreviewItem label="Manager escalation" value={formatPolicyTime(preview?.managerEscalationAt ?? workspaceData.closingPreview.managerEscalationAt, timezone)} />
                <PreviewItem label="Hard cutoff" value={formatPolicyTime(preview?.hardCutoffAt ?? workspaceData.closingPreview.hardCutoffAt, timezone)} />
                <PreviewItem label="Provisional close time" value={formatPolicyTime(preview?.provisionalClockOutAt ?? workspaceData.closingPreview.provisionalClockOutAt, timezone)} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                CRM staff should scan out normally. If the shift remains open after the hard cutoff, CradleHub provisionally closes it at the latest normal closing time and sends it for confirmation.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium">Automatic intervention</div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <PreviewItem label="Policy" value={closingPolicyEnabled ? "Enabled" : "Disabled"} />
                <PreviewItem label="Reminder" value="CRM staff at latest normal clock-out" />
                <PreviewItem label="Escalation recipients" value="CRM Head or branch manager" />
                <PreviewItem label="Hard-cutoff behavior" value="Provisional close + missing clock-out review" />
                <PreviewItem label="Last successful run" value={formatDateTime(workspaceData.scheduler.lastRunAt)} />
                <PreviewItem label="Next expected run" value={formatDateTime(workspaceData.scheduler.nextExpectedRunAt)} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Scheduler status: {schedulerLabel}. Supabase runs four bounded daily safety stages; normal dynamic recalculation is event-driven.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <RuleField label="Effective date (blank = now)" htmlFor="attendance-effective-date">
                <Input id="attendance-effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
              </RuleField>
              <RuleField label="Change reason" htmlFor="attendance-change-reason" className="md:col-span-2">
                <Input id="attendance-change-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              </RuleField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{workspaceData.affectedClosingScheduleRows} active CRM closing schedule rows may use this policy.</span>
              <span>Last worker run: {formatDateTime(workspaceData.scheduler.lastRunAt)}</span>
            </div>
            {workspaceData.scheduler.lastError ? (
              <Alert variant="destructive">
                <AlertTitle>Last worker error</AlertTitle>
                <AlertDescription>{workspaceData.scheduler.lastError}</AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <AttendanceCategoryRulesEditor
              branchId={branchId}
              categories={workspaceData.categories}
              onSaved={setWorkspaceData}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting changed</TableHead>
                  <TableHead>Previous value</TableHead>
                  <TableHead>New value</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Changed by</TableHead>
                  <TableHead>Changed at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceData.history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">No rule changes have been recorded yet.</TableCell>
                  </TableRow>
                ) : (
                  workspaceData.history.map((item) => (
                    <TableRow key={`${item.scope}:${item.id}`}>
                      <TableCell>
                        <div className="font-medium">
                          {item.category ? ATTENDANCE_STAFF_CATEGORY_LABELS[item.category] : "Branch defaults"}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.reason}</div>
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal text-xs">{historyValueSummary(item, "previous")}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal text-xs">{historyValueSummary(item, "new")}</TableCell>
                      <TableCell>{formatDateTime(item.effectiveFrom)}</TableCell>
                      <TableCell>{item.changedByName ?? "System / administrator"}</TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>

      {activeTab === "closing" ? (
        <CardFooter className="justify-end">
          <Button type="button" onClick={save} disabled={isPending}>
            <Save data-icon="inline-start" />
            {isPending ? "Saving..." : "Save Attendance rules"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function RuleField({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return <div className={`grid gap-2 ${className ?? ""}`}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function NumberField({ id, label, value, onChange, min, max }: { id: string; label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <RuleField label={label} htmlFor={id}><Input id={id} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></RuleField>;
}

function SwitchField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><Label htmlFor={id}>{label}</Label><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>;
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-medium">{value}</div></div>;
}
