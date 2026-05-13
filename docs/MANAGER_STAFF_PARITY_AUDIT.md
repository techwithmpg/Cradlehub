# Manager Staff Parity Audit

> Date: 2026-05-13
> Auditor: Kimi
> Scope: Owner vs Manager staff management capabilities

---

## Owner Staff Capabilities Found

| # | Capability | Location | Server Action |
|---|-----------|----------|---------------|
| 1 | View staff list (all branches) | `/owner/staff` | `getAllStaff()`, `getPendingStaff()` |
| 2 | View staff details / edit page | `/owner/staff/[staffId]` | Page loads staff + services |
| 3 | Edit staff profile (name, phone) | `/owner/staff/[staffId]` | `updateStaffAction` |
| 4 | Update system role | `/owner/staff/[staffId]` | `updateStaffAction` |
| 5 | Update staff type (job function) | `/owner/staff/[staffId]` | `updateStaffAction` |
| 6 | Update tier / therapist level | `/owner/staff/[staffId]` | `updateStaffAction` |
| 7 | Toggle department head (`is_head`) | `/owner/staff/[staffId]` | `updateStaffAction` |
| 8 | Activate / deactivate staff | `/owner/staff/[staffId]` | `updateStaffAction` (`isActive`) |
| 9 | Assign branch | `/owner/staff/[staffId]` | `updateStaffAction` (`branchId`) |
| 10 | Assign service capabilities | `/owner/staff/[staffId]` | `updateStaffAction` → `syncStaffServices` |
| 11 | Direct invite (create staff + email) | `/owner/staff/new` | `createStaffAction` |
| 12 | Generate public onboarding link | `/owner/staff/invite` | Static env vars |
| 13 | View onboarding requests | `/owner/staff/onboarding` | Admin client select |
| 14 | Approve onboarding | `/owner/staff/onboarding` | `approveOnboardingAction` |
| 15 | Reject onboarding | `/owner/staff/onboarding` | `rejectOnboardingAction` |
| 16 | Delete / remove staff | — | **NOT IMPLEMENTED** for Owner either |

**Notes:**
- `updateStaffAction` already supports manager branch-scoped updates (calls `requireOwnerOrManager()`), but there is no manager-facing UI to reach it.
- No `deleteStaffAction` exists anywhere in the codebase. Staff can only be deactivated (`is_active = false`).
- The owner edit form hardcodes role options: `manager`, `crm`, `csr_head`, `csr_staff`, `csr`, `staff`. It does not expose `owner`, `assistant_manager`, `store_manager`, `service_head`, `service_staff`, `driver`, `utility` in the dropdown, even though the DB supports them.

---

## Manager Staff Capabilities Currently Available

| # | Capability | Location | Notes |
|---|-----------|----------|-------|
| 1 | View active staff list (branch-scoped) | `/manager/staff` | `getStaffByBranchWithBranches()` |
| 2 | View pending staff | `/manager/staff?tab=pending` | `getPendingStaffByBranch()` |
| 3 | Search & filter staff | `/manager/staff` | Filter bar (no branch filter) |
| 4 | Preview panel with staff details | `/manager/staff` | `StaffPreviewPanel` |
| 5 | Manage staff schedules | `/manager/staff` | `setStaffScheduleAction`, overrides, blocked times |
| 6 | Review onboarding requests | `/manager/staff/onboarding` | Branch-scoped |
| 7 | Approve onboarding (operational roles) | `/manager/staff/onboarding` | `approveOnboardingAction` + `canApproveStaffOnboarding` |
| 8 | Reject onboarding | `/manager/staff/onboarding` | `rejectOnboardingAction` |
| 9 | Mobile read-only staff overview | `/manager` (mobile tab) | `ManagerStaffScreen` |

---

## Missing Manager Capabilities

| # | Missing Capability | Impact |
|---|-------------------|--------|
| 1 | **Edit staff profile** | No `/manager/staff/[staffId]` route. Clicking "Edit profile" 404s. |
| 2 | **Update system role** | Cannot reach `updateStaffAction`. Preview panel hides "Change Role". |
| 3 | **Update staff type** | No UI exposed. |
| 4 | **Update tier / therapist level** | No UI exposed. |
| 5 | **Toggle department head** | No UI exposed. |
| 6 | **Activate / deactivate staff** | Preview panel hides "Deactivate Staff" for manager. |
| 7 | **Assign branch** | Preview panel hides "Assign Branch". Should be locked to manager's branch anyway. |
| 8 | **Assign service capabilities** | No UI exposed. |
| 9 | **Direct invite / create staff** | No `/manager/staff/new` or `/manager/staff/invite` pages. |
| 10 | **Delete / remove staff** | Not implemented for Owner either. Out of scope for parity. |
| 11 | **Mobile staff editing** | Mobile staff cards are not clickable. |

---

## Safe Parity Plan

### What will be mirrored to Manager

1. **Staff detail / edit page** (`/manager/staff/[staffId]`)
   - Load staff from manager's branch only.
   - Return `notFound()` if staff is outside branch.
   - Render the same edit form as Owner.

2. **Shared `StaffEditForm`** extracted to `src/components/features/staff/staff-edit-form.tsx`
   - Accepts `workspaceContext: "owner" | "manager"`.
   - Owner: full controls, all branches, all roles in schema.
   - Manager: same controls EXCEPT:
     - Branch field is locked to manager's branch (read-only or hidden).
     - System role dropdown excludes `manager` and any sensitive roles.
     - Cannot edit staff whose current role is owner/admin/manager/etc.

3. **Preview panel updates**
   - Manager sees "Deactivate Staff" quick action (links to edit page).
   - Manager sees "Edit Profile" for all branch staff.
   - "Assign Branch" remains hidden for manager (branch is locked).
   - "Change Role" remains as a quick action linking to edit page.

4. **Mobile staff screen updates**
   - Staff cards become clickable links to `/manager/staff/${member.id}`.

### Server-side hardening (mandatory)

Every manager mutation via `updateStaffAction` must check:
- Caller is authenticated and active.
- Caller has `manager` / `assistant_manager` / `store_manager` role (or owner).
- Target staff belongs to manager's branch.
- Target staff is NOT a protected account (`owner`, `manager`, `assistant_manager`, `store_manager`, `super_admin`, `platform_admin`).
- If `systemRole` is being changed, new role is manager-safe (`staff`, `csr_staff`, `csr_head`, `crm`, `csr`).
- If `branchId` is being changed, it equals manager's branch.

### What remains Owner-only

- Cross-branch staff viewing and editing.
- Direct invite (`/owner/staff/new`) — creating auth users via email invite.
- Public onboarding link generation (`/owner/staff/invite`).
- Assigning `manager` or higher roles.
- Deleting / removing staff (not implemented for anyone).

---

## Implemented Manager Staff Parity

| # | Capability | Implementation |
|---|-----------|----------------|
| 1 | **Manager staff detail/edit page** | Created `src/app/(dashboard)/manager/staff/[staffId]/page.tsx` with branch-scoped data loading and `notFound()` fallback. |
| 2 | **Shared reusable edit form** | Extracted `src/components/features/staff/staff-edit-form.tsx` used by both Owner and Manager detail pages. |
| 3 | **Edit profile (name, phone)** | Available in Manager edit form. Server action allows manager branch-scoped updates. |
| 4 | **Update system role** | Manager form shows manager-safe roles only (`staff`, `csr_staff`, `csr_head`, `crm`, `csr`). Server action blocks unsafe role assignments. |
| 5 | **Update staff type / job function** | Available in Manager edit form. |
| 6 | **Update tier / therapist level** | Available in Manager edit form. |
| 7 | **Toggle department head (`is_head`)** | Available in Manager edit form. |
| 8 | **Activate / deactivate staff** | Available in Manager edit form (`isActive` checkbox). Preview panel now shows "Deactivate Staff" for manager context. |
| 9 | **Assign branch** | Branch field is locked to manager's branch (read-only select with single option). Server action rejects branch changes outside manager's branch. |
| 10 | **Assign service capabilities** | Service capability checkboxes available in Manager edit form. Server action syncs `staff_services`. |
| 11 | **Mobile staff detail navigation** | Manager mobile staff cards are now clickable links to `/manager/staff/[staffId]`. |
| 12 | **Server-side hardening** | `updateStaffAction` enforces:<br>- Authentication + active status<br>- Caller must be owner or manager<br>- Target staff must be in manager's branch<br>- Target staff must NOT be a protected account (`owner`, `manager`, `assistant_manager`, `store_manager`, `super_admin`, `platform_admin`)<br>- New role must be manager-safe<br>- New branch must equal manager's branch<br>- Revalidates both `/owner/staff` and `/manager/staff` lists + detail pages. |
| 13 | **Protected account UX** | Manager viewing an owner/admin/manager record sees:<br>"This action requires owner approval." |

---

## Remaining Owner-only Staff Actions

| # | Action | Reason |
|---|--------|--------|
| 1 | **Cross-branch staff viewing/editing** | Manager scope is intentionally limited to assigned branch. |
| 2 | **Direct invite (`/owner/staff/new`)** | Creating auth users via email invite requires owner privileges. Manager can still use public onboarding link. |
| 3 | **Public onboarding link generation (`/owner/staff/invite`)** | Link generation and access code are owner/manager visible, but manager onboarding approval already exists. |
| 4 | **Assigning `manager` or higher roles** | Requires owner approval to prevent unauthorized privilege escalation. |
| 5 | **Delete / remove staff** | **Not implemented for Owner either.** Staff can only be deactivated (`is_active = false`). If hard delete is needed in the future, it must be added for both workspaces with appropriate safeguards. |
