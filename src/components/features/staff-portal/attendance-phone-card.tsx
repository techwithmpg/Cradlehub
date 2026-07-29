"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cancelAttendancePhoneRequestAction,
  completeAttendancePhoneRequestAction,
  completeProfileAttendanceRecoveryAction,
  renameOwnAttendancePhoneAction,
  requestAttendancePhoneAction,
} from "@/app/(dashboard)/staff-portal/profile/attendance-device-actions";
import type { StaffAttendancePhoneState } from "@/lib/attendance/device-registration";

function statusLabel(status: NonNullable<StaffAttendancePhoneState["request"]>["status"]): string {
  if (status === "approved") return "Approved — finish on this phone";
  if (status === "pending") return "Pending CRM review";
  if (status === "rejected") return "Request declined";
  if (status === "expired") return "Approval expired";
  if (status === "completed") return "Completed";
  return "Cancelled";
}

export function AttendancePhoneCard({ state }: { state: StaffAttendancePhoneState }) {
  const [isPending, startTransition] = useTransition();
  const [replacementId, setReplacementId] = useState(state.activeDevices[0]?.id ?? "");
  const [label, setLabel] = useState(state.registeredDevice?.label ?? "");
  const request = state.request;
  const hasOpenRequest = request?.status === "pending" || request?.status === "approved";

  function run(action: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <Card id="attendance-phone">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="size-5 text-primary" />
              Attendance phone
            </CardTitle>
            <CardDescription className="mt-1">
              This card shows whether the current browser is ready. A removed connection must be
              restored on this same browser.
            </CardDescription>
          </div>
          {state.registeredDevice ? (
            <Badge variant="secondary" className="gap-1 text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Ready
            </Badge>
          ) : hasOpenRequest ? (
            <Badge variant="outline" className="gap-1 text-amber-700">
              <Clock3 className="size-3.5" />{" "}
              {request.status === "approved" ? "Approved" : "Pending"}
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.profileRecovery ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-bold text-emerald-950">CRM sent a browser connection request</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Open this page on the phone and browser you want to use for Attendance, then connect
              it now.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Reason: {state.profileRecovery.reason.replaceAll("_", " ")} · Expires{" "}
              {new Date(state.profileRecovery.expiresAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <Button
              className="mt-3"
              disabled={isPending}
              onClick={() =>
                run(() => completeProfileAttendanceRecoveryAction(state.profileRecovery!.id))
              }
            >
              <ShieldCheck data-icon="inline-start" /> Connect this browser now
            </Button>
          </div>
        ) : null}

        {state.recentBrowserRecoveryCount >= 2 ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-bold">Keep Attendance connected</p>
            <p className="mt-1 leading-6">
              This account has had {state.recentBrowserRecoveryCount} browser reconnections in the
              last 30 days. When clearing browser data, do not select Cookies and site data, Site
              settings, Clear storage, or All browser data.
            </p>
          </div>
        ) : null}

        {state.registeredDevice ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="font-medium">This phone: {state.registeredDevice.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The secure browser credential is stored as an HttpOnly cookie.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="attendance-phone-label">Phone name</Label>
                <Input
                  id="attendance-phone-label"
                  value={label}
                  maxLength={60}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <Button
                className="self-end"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    renameOwnAttendancePhoneAction({ deviceId: state.registeredDevice!.id, label })
                  )
                }
              >
                Save name
              </Button>
            </div>
          </div>
        ) : null}

        {request ? (
          <div className="rounded-xl border p-4">
            <p className="font-medium">{statusLabel(request.status)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.status === "approved"
                ? "Approval is bound to the phone that sent the request and expires after 24 hours."
                : request.status === "pending"
                  ? "CRM can approve or reject this request from the Attendance device registry."
                  : request.reviewerNote || "You can submit a new request from this phone."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {request.status === "approved" ? (
                <Button
                  disabled={isPending}
                  onClick={() => run(() => completeAttendancePhoneRequestAction(request.id))}
                >
                  <ShieldCheck data-icon="inline-start" /> Finish connecting this phone
                </Button>
              ) : null}
              {request.status === "pending" ? (
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => cancelAttendancePhoneRequestAction(request.id))}
                >
                  Cancel request
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!state.registeredDevice && !hasOpenRequest ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Fastest way to connect this phone</p>
              <p className="mt-1 leading-6">
                Scan the branch Attendance QR in this browser. When the connection page appears,
                sign in with your own staff account. The system will connect this browser and
                continue the saved scan automatically.
              </p>
              <p className="mt-2 font-medium">Scan once. Do not refresh or scan repeatedly.</p>
            </div>
            {state.activeDevices.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="replace-attendance-phone">Phone to replace</Label>
                <Select
                  value={replacementId}
                  onValueChange={(value) => setReplacementId(value ?? "")}
                >
                  <SelectTrigger id="replace-attendance-phone">
                    <SelectValue placeholder="Choose an active phone" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.activeDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              disabled={isPending || (state.activeDevices.length > 0 && !replacementId)}
              onClick={() =>
                run(() =>
                  requestAttendancePhoneAction({
                    requestType: state.activeDevices.length > 0 ? "replacement" : "new_phone",
                    existingDeviceId: state.activeDevices.length > 0 ? replacementId : null,
                  })
                )
              }
            >
              <Smartphone data-icon="inline-start" />
              {state.activeDevices.length > 0
                ? "Request replacement browser"
                : "Ask CRM for a browser connection"}
            </Button>
          </div>
        ) : null}

        {hasOpenRequest ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => window.location.reload()}
          >
            <RefreshCw data-icon="inline-start" /> Refresh status
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
