Task: CRM UI polish — tabbed centered Edit Staff Profile modal and operational modal improvements.
Status: IN_PROGRESS

## What was just verified (2026-05-30)

CRM/CSR backend stabilization passed browser verification:
- Schedule update (weekly hours): csr_staff can now save ✅
- Staff profile update (nickname, phone, tier): csr_staff can now save ✅
- Service assignment (staff_services): csr_staff can now save ✅
- Customer update: csr_staff can now save (policy applied) ✅
- Booking payment/status: csr_staff can now save (policy applied) ✅
- Regular CSR/CRM is no longer blocked — owner privilege is not the only working path

## Active work

UI polish: tabbed centered Edit Staff Profile modal for /crm/staff?tab=management
Backend is now safe to build UI on top of.
