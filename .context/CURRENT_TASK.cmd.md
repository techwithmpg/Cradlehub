# CURRENT TASK: CRM Operational Staff/Service Management

## Status
DONE

## Task ID
CRM-OPS-STAFF-SVC-001

## Description
CRM workspace is now fully operational for staff and service management.

## What was done
1. ✅ `updateStaffAction` expanded to CRM/CSR roles (branch-scoped, same as manager)
2. ✅ `toggleStaffActiveAction` added — CRM can activate/deactivate staff
3. ✅ `updateStaffServicesFromCrmAction` created in `src/lib/actions/crm-staff-services.ts`
4. ✅ `StaffPreviewPanel` shows CRM quick actions (Edit Profile, Manage Services, Activate/Deactivate)
5. ✅ `CrmStaffManagementTab` orchestrates StaffEditForm Sheet + StaffServiceEditorSheet
6. ✅ `CrmStaffAssignmentsTab` has Manage button per row wired to service editor
7. ✅ `updateBranchServiceVisibilityAction` now allows CRM roles (was owner-only)
8. ✅ `ServiceAssignmentTableRow` has visibility toggle button (🌐 Public / 🔒 CSR Only)
9. ✅ CRM permission helpers updated in `crm-permissions.ts`
10. ✅ Setup Center shortcuts already pointed to /crm/* (no changes needed)
