# CradleHub Operational Readiness Checklist

Record evidence, operator, environment, and timestamp for every item. A blank or inferred check is not a pass.

1. **Branch setup:** active branches have name, address, timezone, contact details, and hours.
2. **Staff profiles:** every active staff member is operational, unarchived, and has current contact/job data.
3. **Roles and permissions:** test least-privilege access for Owner, CRM, Staff, and Driver; Manager activation stays paused.
4. **Staff schedules:** each operational staff member has an intentional weekly schedule or documented exception.
5. **Staff service capability:** every bookable service has enough eligible assigned providers.
6. **Service pricing and duration:** base and branch overrides are valid and customer-facing values match.
7. **Public service eligibility:** visibility and in-spa/home flags match the intended catalogue.
8. **Home Service eligibility:** distance, address, driver capacity, travel buffer, and provider capability are verified.
9. **Consultation-only packages:** couples, besties, parties, and multi-person packages show contact guidance and reject automatic booking.
10. **Rooms and resources:** active rooms/resources exist, capacity is correct, and conflicting assignment is blocked.
11. **Booking rules:** advance window, lead time, interval, closures, buffers, and capacity are verified per branch.
12. **Attendance QR codes:** one active Attendance point per branch is printed, scanned, versioned, and recoverable.
13. **Attendance devices:** correct-branch registration, limits, replacement, revocation, and lost-device recovery are tested.
14. **Attendance cron jobs:** exactly four named jobs are configured, active, succeeding, and monitored.
15. **Open Attendance records:** no stale live rows remain; overnight shifts and test rows are distinguished.
16. **Attendance enforcement flag:** `ATTENDANCE_ENFORCEMENT_ENABLED` is deliberately set and launch diagnostics match.
17. **Booking lifecycle:** pending, confirmation, arrival, service, completion, cancellation, and no-show are tested.
18. **Payment lifecycle:** pay-on-site, confirmation, correction, refund/void controls, and audit logs are tested.
19. **Split and partial payments:** totals, outstanding balance, method/reference, and reporting reconcile.
20. **Close Day:** cash totals, variance, operator sign-off, reopen/correction path, and audit evidence reconcile.
21. **Home Service dispatch:** location, capacity, timing, therapist readiness, and exceptions are tested.
22. **Driver assignment:** assignment, acceptance, trip lifecycle, navigation, completion, and fallback are tested.
23. **Notifications:** CRM, staff, driver, and owner targets, deduplication, links, and failure handling are verified.
24. **Production environment variables:** Supabase, site URL, maps, agent/AI flags, cron, and Attendance values are present without client-side secrets.
25. **Vercel domains and redirects:** canonical domain, HTTPS, callback URLs, public pages, and protected redirects are verified.
26. **Supabase RLS:** exposed tables have RLS; anon/authenticated/service behavior is probed with least privilege.
27. **Backup and rollback:** current database/application backup, restore owner, rollback commands, and decision window are recorded.
28. **Migration history:** repository duplicates and live-only/repository-only versions are reconciled before broad push.
29. **One-day controlled pilot:** named branch/staff, support owner, monitoring, stop criteria, and incident channel are scheduled.
30. **Staff-training readiness:** visible controls are stable, deferred features are identified, and the manual matches the deployed build.

## Required sign-off

- Engineering: code gates, database lint, migration evidence, and rollback ready.
- Operations: branch/service/staff/Attendance data reviewed.
- Product owner: consultation-only policy and intentionally deferred surfaces accepted.
- Pilot lead: production-only browser/device/payment/dispatch scripts completed.
