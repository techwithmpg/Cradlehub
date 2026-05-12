# MVP Temporary Permissions

This document outlines temporary permission rules and workarounds implemented for the CradleHub MVP. These rules are designed to allow operational flexibility during the initial launch phase while maintaining basic security boundaries.

## CSR Staff Onboarding Approval

**Context:** During the MVP, the business owner or primary managers may not always be available to process new staff onboarding requests. To avoid bottlenecks, authorized CSR (front-desk) users can process applications for normal operational staff.

**Rules:**
- **Authorized Roles:** `crm`, `csr_head`, `csr_staff`, and legacy `csr`.
- **Scope:** Branch-scoped. CSRs can only approve applicants who requested their specific branch.
- **Allowed Target Roles (Operational):**
  - Massage Therapist (`staff_type: therapist`, `system_role: staff`)
  - Nail Technician (`staff_type: nail_tech`, `system_role: staff`)
  - Aesthetician (`staff_type: aesthetician`, `system_role: staff`)
  - Driver (`staff_type: driver`, `system_role: driver`)
  - Utility / Housekeeping (`staff_type: utility`, `system_role: utility`)
  - CSR / Front Desk (`staff_type: csr`, `system_role: csr_staff`)
- **Restricted Target Roles (Management/Admin):**
  - Owner
  - Manager
  - Assistant Manager
  - Store Manager
  - Branch Manager
  - Super Admin
  - Platform Admin
- **Sensitive Operations:** CSRs cannot turn an operational applicant into a manager/admin. Any role that grants access to business settings, finance reports, or permission management requires Owner or Manager approval.

**Implementation:**
- A dedicated "Staff Applications" page is added to the CRM workspace (`/crm/staff-applications`).
- The `canApproveStaffOnboarding` helper in `src/lib/staff/approval-permissions.ts` enforces these rules.
- UI elements (like the Approve button) are disabled with informative messages when a CSR encounters a management-level application.

## CRM Workspace Naming

**Context:** To better align with the application's domain and the mental model of the front-desk staff, the "CRM" workspace is often referred to as "Front Desk" in the UI.

**Decision:** The sidebar and breadcrumbs use "Front Desk" for the CRM workspace.

## Future Review

These temporary rules should be reviewed and potentially tightened after the MVP phase, specifically:
1. Re-evaluate if `csr_staff` should have approval permissions.
2. Consider implementing a multi-stage approval process for management roles.
3. Move towards a more granular permission system instead of role-based checks where appropriate.
