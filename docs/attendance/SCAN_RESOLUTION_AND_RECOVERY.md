# Attendance scan resolution and Recovery

`src/lib/attendance/scan-resolution.ts` is the canonical safe boundary between
the Attendance engine result and staff/CRM presentation. It owns safe codes,
category, copy, protected-record explanation, next steps, resolution owner,
retry policy, incident policy, severity, and permitted CRM actions. Raw database
messages are never copied into staff-facing fields.

Recovery is event-backed. A staff profile with no active device is inventory,
not an incident. Cases come from persisted exceptions, failed scan evidence,
registration/recovery requests, or explicit support events. Dedupe keys and
occurrence timestamps preserve repeated evidence without multiplying cards.

Review records acknowledgement only. Resolution requires a concrete correction,
rejection, verified device/schedule state, or successful idempotent reprocessing.
CRM questions reuse `workspace_notifications` and `workflow_tasks`; conversation
messages are append-only in `attendance_issue_messages`. Staff RLS is self-only,
CRM reads are branch-scoped, and technical context remains protected.
