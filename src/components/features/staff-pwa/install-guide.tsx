"use client";

import { Share, PlusSquare, Smartphone, Check } from "lucide-react";
import { StaffConfirmDialog } from "./confirm-dialog";

type StaffInstallGuideProps = {
  open: boolean;
  onClose: () => void;
  isIOS?: boolean;
};

export function StaffInstallGuide({
  open,
  onClose,
  isIOS = true,
}: StaffInstallGuideProps) {
  const content = (
    <div className="flex flex-col gap-4 text-left">
      <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE4DC] p-2.5 text-xs text-[#1E293B]">
        <div className="font-semibold text-[#163A2B]">Cradle Hub — Team Workspace</div>
        <p className="text-[11px] text-[#475569] mt-0.5">
          Dedicated operational app for staff, providers, drivers, and utility teams.
        </p>
      </div>

      <p className="text-xs text-[#475569]">
        Install on your phone for full-screen operational access, attendance, and job schedules:
      </p>

      {isIOS ? (
        <ol className="flex flex-col gap-3 text-xs text-[#1E293B]">
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#163A2B] text-white text-[11px] font-bold">
              1
            </span>
            <span>
              Tap the <strong>Share</strong> button{" "}
              <Share size={14} className="inline-block text-[#163A2B]" aria-hidden="true" /> in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#163A2B] text-white text-[11px] font-bold">
              2
            </span>
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong>{" "}
              <PlusSquare size={14} className="inline-block text-[#163A2B]" aria-hidden="true" />.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#163A2B] text-white text-[11px] font-bold">
              3
            </span>
            <span>
              Confirm <strong>Cradle Hub</strong>, then tap <strong>Add</strong> in the top right corner.
            </span>
          </li>
        </ol>
      ) : (
        <div className="flex flex-col gap-3 text-xs text-[#1E293B]">
          <div className="flex items-start gap-2.5">
            <Smartphone size={18} className="text-[#163A2B] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              In your browser menu (three dots in top right), tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Check size={18} className="text-[#163A2B] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Launch from your home screen as <strong>Cradle Hub</strong>.
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE4DC] p-2.5 text-[11px] text-[#64748B]">
        <div>
          <strong className="text-[#1E293B]">Security & Sessions:</strong> Installing does not authenticate you or grant permissions.
        </div>
        <div>
          <strong className="text-[#1E293B]">Launch Behavior:</strong> If opened while logged out, the app will request secure sign-in before resolving your operational role.
        </div>
      </div>
    </div>
  );

  return (
    <StaffConfirmDialog
      open={open}
      title={isIOS ? "Add Cradle Hub to Home Screen" : "Install Cradle Hub"}
      description={content}
      confirmLabel="Got it"
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}
