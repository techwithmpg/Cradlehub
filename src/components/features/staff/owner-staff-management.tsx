"use client";

import { useState } from "react";
import { StaffManagementWorkspace } from "./staff-management-workspace";
import { OwnerStaffQuickEditModal, type OwnerStaffEditMode } from "./owner-staff-quick-edit-modal";
import type { StaffMember, StaffTab } from "./staff-management-utils";

export function OwnerStaffManagement({
  allStaff,
  pendingStaff,
  initialTab,
}: {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  initialTab: StaffTab;
}) {
  const [editor, setEditor] = useState<{
    staffMember: StaffMember;
    mode: OwnerStaffEditMode;
  } | null>(null);

  return (
    <>
      <StaffManagementWorkspace
        allStaff={allStaff}
        pendingStaff={pendingStaff}
        initialTab={initialTab}
        workspaceContext="owner"
        onEditStaff={(staffMember) => setEditor({ staffMember, mode: "profile" })}
        onManageServices={(staffMember) => setEditor({ staffMember, mode: "services" })}
        onEditWorkSetup={(staffMember) => setEditor({ staffMember, mode: "work" })}
      />
      {editor && (
        <OwnerStaffQuickEditModal
          key={editor.staffMember.id + ":" + editor.mode}
          staffMember={editor.staffMember}
          mode={editor.mode}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
