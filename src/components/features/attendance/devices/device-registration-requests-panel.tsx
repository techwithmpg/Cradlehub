"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ShieldCheck, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reviewStaffDeviceRegistrationRequestAction } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceDeviceRegistryData } from "@/lib/attendance/types";
import type {
  StaffDeviceRegistrationRejectionReason,
  StaffDeviceRegistrationRequest,
} from "@/lib/attendance/device-registration";

const REJECTION_REASONS: Array<{ value: StaffDeviceRegistrationRejectionReason; label: string }> = [
  { value: "unable_to_verify_request", label: "Unable to verify request" },
  { value: "device_limit_reached", label: "Device limit reached" },
  { value: "shared_phone_not_permitted", label: "Shared phone not permitted" },
  { value: "staff_account_inactive", label: "Staff account inactive" },
  { value: "security_concern", label: "Security concern" },
  { value: "other", label: "Other" },
];

function formatStatus(status: StaffDeviceRegistrationRequest["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function DeviceRegistrationRequestsPanel({ registry }: { registry: AttendanceDeviceRegistryData }) {
  const [requests, setRequests] = useState(registry.registrationRequests);
  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );
  const [selectedId, setSelectedId] = useState(pendingRequests[0]?.id ?? requests[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState<StaffDeviceRegistrationRejectionReason>("unable_to_verify_request");
  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;
  const staffDevices = selected
    ? registry.activeDevices.filter((device) => device.staffId === selected.staffId)
    : [];
  const [replacementId, setReplacementId] = useState("");
  const [isPending, startTransition] = useTransition();

  function review(decision: "approved" | "rejected") {
    if (!selected) return;
    const selectedReplacement = replacementId || selected.existingDeviceId;
    if (decision === "approved" && selected.requestType === "replacement" && !selectedReplacement) {
      toast.error("Choose the active phone being replaced.");
      return;
    }
    startTransition(async () => {
      const result = await reviewStaffDeviceRegistrationRequestAction({
        branchId: registry.branchId,
        requestId: selected.id,
        decision,
        reviewerNote: note,
        rejectionReason: decision === "rejected" ? rejectionReason : null,
        replacementDeviceId: decision === "approved" ? selectedReplacement : null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRequests((current) => current.map((request) => request.id === result.data.id ? result.data : request));
      setNote("");
      toast.success(decision === "approved" ? "Phone request approved." : "Phone request rejected.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-primary" /> Staff phone registration requests
            </CardTitle>
            <CardDescription>Review staff-submitted phones before they can become attendance devices.</CardDescription>
          </div>
          <Badge variant={pendingRequests.length > 0 ? "default" : "secondary"}>{pendingRequests.length} pending</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No staff phone requests yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-2" aria-label="Staff phone requests">
              {requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === request.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => {
                    setSelectedId(request.id);
                    setReplacementId(request.existingDeviceId ?? "");
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{request.staffName}</span>
                    <Badge variant="outline">{formatStatus(request.status)}</Badge>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{request.deviceLabel} · {request.requestType === "replacement" ? "Replacement" : "New phone"}</span>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><Smartphone className="size-5 text-primary" /></div>
                  <div>
                    <h3 className="font-semibold">{selected.staffName}</h3>
                    <p className="text-sm text-muted-foreground">{selected.deviceLabel} · {selected.browserName ?? "Unknown browser"} · {selected.platformName ?? "Unknown platform"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Requested {new Date(selected.requestedAt).toLocaleString()}</p>
                  </div>
                </div>

                {selected.status === "pending" ? (
                  <div className="mt-5 space-y-4">
                    {selected.requestType === "replacement" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="crm-replacement-device">Active phone to replace</Label>
                        <Select value={replacementId || selected.existingDeviceId || ""} onValueChange={(value) => setReplacementId(value ?? "")}>
                          <SelectTrigger id="crm-replacement-device"><SelectValue placeholder="Choose a phone" /></SelectTrigger>
                          <SelectContent>
                            {staffDevices.map((device) => <SelectItem key={device.id} value={device.id}>{device.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="crm-device-review-note">Review note</Label>
                      <Textarea id="crm-device-review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional approval note or required context for a rejection" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="crm-device-rejection-reason">Rejection reason</Label>
                      <Select value={rejectionReason} onValueChange={(value) => setRejectionReason(value as StaffDeviceRegistrationRejectionReason)}>
                        <SelectTrigger id="crm-device-rejection-reason"><SelectValue /></SelectTrigger>
                        <SelectContent>{REJECTION_REASONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isPending} onClick={() => review("approved")}><Check data-icon="inline-start" /> Approve for 24 hours</Button>
                      <Button variant="destructive" disabled={isPending} onClick={() => review("rejected")}><X data-icon="inline-start" /> Reject</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{formatStatus(selected.status)}</p>
                    <p className="mt-1 text-muted-foreground">{selected.reviewerNote || "This request has already been reviewed."}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
