"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import { DriverProfileEditForm } from "./driver-profile-edit-form";
import { DriverProfileView } from "./driver-profile-view";

type ProfileModalMode = "view" | "edit";

type DriverProfileSheetProps = {
  staff: StaffPortalStaff;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DriverProfileSheet({ staff, open, onOpenChange }: DriverProfileSheetProps) {
  const [mode, setMode] = useState<ProfileModalMode>("view");

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setMode("view");
  }

  function closeAfterNavigation() {
    onOpenChange(false);
    setMode("view");
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton
        className="z-[70] max-h-[88dvh] overflow-hidden rounded-t-[2rem] border-t border-stone-200 bg-[#fffaf4] p-0 shadow-2xl shadow-black/20 md:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{mode === "edit" ? "Edit Profile" : "Driver Profile"}</SheetTitle>
          <SheetDescription>
            {mode === "edit" ? "Update your driver profile details." : "View your driver profile details."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-center pb-2 pt-4">
          <span className="h-1.5 w-16 rounded-full bg-stone-300" />
        </div>

        <div className="max-h-[calc(88dvh-2.25rem)] overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2">
          {mode === "edit" ? (
            <DriverProfileEditForm
              key={`${staff.id}-${staff.full_name}-${staff.nickname ?? ""}-${staff.phone ?? ""}-${staff.avatar_url ?? ""}`}
              staff={staff}
              onCancel={() => setMode("view")}
              onSaved={() => setMode("view")}
            />
          ) : (
            <DriverProfileView
              staff={staff}
              onEdit={() => setMode("edit")}
              onNavigate={closeAfterNavigation}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
