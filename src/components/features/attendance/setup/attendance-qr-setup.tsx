"use client";

import { useState, useTransition } from "react";
import { Copy, Download, Printer, QrCode, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  ensureAttendanceQrAction,
  ensureRoomQrPointsAction,
  replaceAttendanceQrAction,
  updateAttendanceRulesAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  copyQrScanLink,
  downloadQrPng,
  downloadQrSvg,
  printQrPoint,
} from "@/components/features/attendance/qr-codes/qr-export-client";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceQrSetup({
  data,
  onRefresh,
}: {
  data: AttendanceWorkspaceData;
  onRefresh: () => void;
}) {
  const official =
    data.qrPoints.find((point) => point.point_type === "attendance" && point.is_active) ?? null;
  const roomPoints = data.qrPoints.filter(
    (point) => point.point_type !== "attendance" && point.is_active
  );
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [registeredOnly, setRegisteredOnly] = useState(
    data.settings.require_registered_device_for_attendance
  );
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onRefresh();
    });
  }
  function saveSettings() {
    startTransition(async () => {
      const result = await updateAttendanceRulesAction({
        branchId: data.branchId,
        settings: { require_registered_device_for_attendance: registeredOnly },
        reason: "Updated QR security settings",
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setSettingsOpen(false);
      onRefresh();
    });
  }
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <section className="rounded-xl border border-[var(--cs-border)] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-sand-dark)]">
                Official staff code
              </p>
              <h2 className="mt-1 text-lg font-bold">Branch Attendance QR</h2>
              <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                Use this code for staff clock-in and clock-out.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 />
              QR settings
            </Button>
          </div>
          {official ? (
            <div className="mt-5 grid gap-5 md:grid-cols-[240px_1fr] md:items-center">
              <div
                className="grid aspect-square overflow-hidden place-items-center rounded-xl border border-[var(--cs-border-soft)] bg-white p-4 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: official.svg ?? "" }}
              />
              <div>
                <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3 text-xs break-all text-[var(--cs-text-muted)]">
                  {official.scan_url ?? "Configure APP_URL to enable the public scan link."}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      printQrPoint({ point: official, branchName: data.branchName, format: "a4" })
                    }
                  >
                    <Printer />
                    Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void copyQrScanLink(official)}>
                    <Copy />
                    Copy link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadQrSvg({ point: official, branchName: data.branchName, format: "a4" })
                    }
                  >
                    <Download />
                    SVG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void downloadQrPng({
                        point: official,
                        branchName: data.branchName,
                        format: "a4",
                      })
                    }
                  >
                    PNG
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(true)}>
                    <RefreshCw />
                    Replace
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-center">
              <div>
                <QrCode className="mx-auto size-9 text-[var(--cs-crm-text)]" />
                <h3 className="mt-3 font-bold">No official code yet</h3>
                <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                  Generate the branch code before staff begin scanning.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => run(ensureAttendanceQrAction)}
                  disabled={pending}
                >
                  Generate QR
                </Button>
              </div>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-[var(--cs-border)] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Room codes</h2>
              <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                Start service sessions from rooms and resources.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(ensureRoomQrPointsAction)}
              disabled={pending}
            >
              Create missing
            </Button>
          </div>
          <div className="mt-4 divide-y divide-[var(--cs-border-soft)]">
            {roomPoints.map((point) => (
              <div key={point.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold">{point.label}</div>
                  <div className="text-xs capitalize text-[var(--cs-text-muted)]">
                    {point.point_type}
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Print ${point.label}`}
                  onClick={() => printQrPoint({ point, branchName: data.branchName, format: "a4" })}
                >
                  <Printer />
                </Button>
              </div>
            ))}
          </div>
          {roomPoints.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--cs-text-muted)]">
              No room codes configured.
            </p>
          ) : null}
        </section>
      </div>
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace official QR?</AlertDialogTitle>
            <AlertDialogDescription>
              The current printed code will stop working immediately. Print and display the
              replacement before the next shift.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (official) run(() => replaceAttendanceQrAction(official.id));
                setConfirmReplace(false);
              }}
            >
              Replace QR
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR settings</DialogTitle>
            <DialogDescription>Control who can use the official Attendance code.</DialogDescription>
          </DialogHeader>
          <label className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <span>
              <span className="block text-sm font-semibold">Registered phones only</span>
              <span className="block text-xs text-[var(--cs-text-muted)]">
                Block scans from phones that are not connected to a staff profile.
              </span>
            </span>
            <Switch checked={registeredOnly} onCheckedChange={setRegisteredOnly} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings} disabled={pending}>
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
