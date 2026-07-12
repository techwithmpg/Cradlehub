# CRM Operational Reset Preview

Generated: 2026-07-11T04:46:15.644779+00:00
Project: lsrbwqhvzjfpiabeolkv
Branch scope: all
Mode: dry-run only

No operational data has been changed. Do not run apply without explicit owner approval.

## Rows Affected

| Table / bucket | Planned action | Rows | Earliest | Latest |
| --- | --- | --- | --- | --- |
| bookings | delete | 114 | 2026-05-01 01:05:41.817098+00 | 2026-07-10 21:05:44.024452+00 |
| booking_events | delete | 139 | 2026-05-01 01:05:41.817098+00 | 2026-07-10 21:05:44.024452+00 |
| booking_payment_logs | delete | 32 | 2026-05-17 11:04:57.179159+00 | 2026-07-10 21:05:44.621866+00 |
| customer_tracking_links | delete booking links | 1 | 2026-07-10 06:16:23.02762+00 | 2026-07-10 06:16:23.02762+00 |
| staff_location_snapshots | delete booking links | 0 | - | - |
| waitlist_requests | preserve row, clear converted_to_booking_id | 0 | - | - |
| attendance_corrections | delete | 2 | 2026-07-10 05:13:49.7471+00 | 2026-07-10 05:18:20.932965+00 |
| attendance_exceptions | delete | 183 | 2026-07-03 08:00:06.143822+00 | 2026-07-11 03:31:14.918778+00 |
| staff_branch_change_requests | preserve row, clear scan_event_id | 2 | 2026-07-10 02:52:24.594196+00 | 2026-07-10 05:43:56.923527+00 |
| qr_scan_events | delete | 238 | 2026-07-03 08:00:05.844626+00 | 2026-07-11 03:31:38.136727+00 |
| staff_shift_checkins | delete | 19 | 2026-07-04 03:03:42.929319+00 | 2026-07-11 03:29:56.794188+00 |
| open_attendance | included in staff_shift_checkins delete | 7 | 2026-07-08 06:43:05.930424+00 | 2026-07-11 03:29:56.794188+00 |
| schedule_overrides | delete | 0 | - | - |
| blocked_times | delete | 0 | - | - |
| device_activation_tokens | delete expired/used/revoked only | 6 | 2026-07-03 10:27:54.449308+00 | 2026-07-10 17:24:41.938397+00 |
| staff_devices_invalid | delete non-active only | 0 | - | - |
| staff_devices_active | preserve | 23 | 2026-07-04 02:06:05.126462+00 | 2026-07-11 03:31:02.410298+00 |
| staff_schedules | preserve | 373 | 2026-04-30 19:05:14.700122+00 | 2026-07-08 08:51:03.39665+00 |

## Branch Breakdown

| Branch | Bookings | Booking events | Scan events | Open attendance | Active devices preserved | Invalid devices | Expired tokens | Schedule overrides | Blocked times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cradle Wellness living  Main Spa | 112 | 137 | 238 | 7 | 23 | 0 | 6 | 0 | 0 |
| Cradle Wellness Living SM | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Dependencies Inspected

| Table | References | Constraint | Definition |
| --- | --- | --- | --- |
| attendance_corrections | staff | attendance_corrections_approved_by_fkey | FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL |
| attendance_corrections | branches | attendance_corrections_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| attendance_corrections | staff_shift_checkins | attendance_corrections_checkin_id_fkey | FOREIGN KEY (checkin_id) REFERENCES staff_shift_checkins(id) ON DELETE SET NULL |
| attendance_corrections | staff | attendance_corrections_corrected_by_fkey | FOREIGN KEY (corrected_by) REFERENCES staff(id) ON DELETE SET NULL |
| attendance_corrections | staff | attendance_corrections_requested_by_fkey | FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL |
| attendance_corrections | staff | attendance_corrections_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL |
| attendance_exceptions | branches | attendance_exceptions_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| attendance_exceptions | staff_shift_checkins | attendance_exceptions_checkin_id_fkey | FOREIGN KEY (checkin_id) REFERENCES staff_shift_checkins(id) ON DELETE SET NULL |
| attendance_exceptions | staff | attendance_exceptions_resolved_by_fkey | FOREIGN KEY (resolved_by) REFERENCES staff(id) ON DELETE SET NULL |
| attendance_exceptions | qr_scan_events | attendance_exceptions_scan_event_id_fkey | FOREIGN KEY (scan_event_id) REFERENCES qr_scan_events(id) ON DELETE SET NULL |
| attendance_exceptions | staff | attendance_exceptions_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL |
| booking_events | bookings | booking_events_booking_id_fkey | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| booking_events | staff | booking_events_changed_by_fkey | FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL |
| booking_payment_logs | bookings | booking_payment_logs_booking_id_fkey | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| booking_payment_logs | staff | booking_payment_logs_changed_by_fkey | FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL |
| bookings | branches | bookings_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT |
| bookings | customers | bookings_customer_id_fkey | FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT |
| bookings | staff | bookings_driver_id_fkey | FOREIGN KEY (driver_id) REFERENCES staff(id) |
| bookings | branch_resources | bookings_resource_id_fkey | FOREIGN KEY (resource_id) REFERENCES branch_resources(id) ON DELETE SET NULL |
| bookings | services | bookings_service_id_fkey | FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT |
| bookings | staff | bookings_session_extended_by_fkey | FOREIGN KEY (session_extended_by) REFERENCES staff(id) ON DELETE SET NULL |
| bookings | qr_scan_events | bookings_session_start_scan_event_id_fkey | FOREIGN KEY (session_start_scan_event_id) REFERENCES qr_scan_events(id) ON DELETE SET NULL |
| bookings | branch_resources | bookings_session_started_from_resource_id_fkey | FOREIGN KEY (session_started_from_resource_id) REFERENCES branch_resources(id) ON DELETE SET NULL |
| bookings | staff | bookings_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT |
| customer_tracking_links | bookings | customer_tracking_links_booking_id_fkey | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| customer_tracking_links | branches | customer_tracking_links_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| customer_tracking_links | staff | customer_tracking_links_created_by_fkey | FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL |
| customer_tracking_links | customers | customer_tracking_links_customer_id_fkey | FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL |
| device_activation_tokens | branches | device_activation_tokens_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| device_activation_tokens | staff | device_activation_tokens_requested_by_fkey | FOREIGN KEY (requested_by) REFERENCES staff(id) ON DELETE SET NULL |
| device_activation_tokens | staff_devices | device_activation_tokens_revoke_previous_device_id_fkey | FOREIGN KEY (revoke_previous_device_id) REFERENCES staff_devices(id) ON DELETE SET NULL |
| device_activation_tokens | staff | device_activation_tokens_revoked_by_fkey | FOREIGN KEY (revoked_by) REFERENCES staff(id) ON DELETE SET NULL |
| device_activation_tokens | staff | device_activation_tokens_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE |
| device_activation_tokens | staff_devices | device_activation_tokens_used_by_device_id_fkey | FOREIGN KEY (used_by_device_id) REFERENCES staff_devices(id) ON DELETE SET NULL |
| qr_scan_events | bookings | qr_scan_events_booking_id_fkey | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL |
| qr_scan_events | branches | qr_scan_events_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL |
| qr_scan_events | staff_shift_checkins | qr_scan_events_checkin_id_fkey | FOREIGN KEY (checkin_id) REFERENCES staff_shift_checkins(id) ON DELETE SET NULL |
| qr_scan_events | staff_devices | qr_scan_events_device_id_fkey | FOREIGN KEY (device_id) REFERENCES staff_devices(id) ON DELETE SET NULL |
| qr_scan_events | qr_points | qr_scan_events_qr_point_id_fkey | FOREIGN KEY (qr_point_id) REFERENCES qr_points(id) ON DELETE SET NULL |
| qr_scan_events | branch_resources | qr_scan_events_resource_id_fkey | FOREIGN KEY (resource_id) REFERENCES branch_resources(id) ON DELETE SET NULL |
| qr_scan_events | staff | qr_scan_events_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL |
| staff_branch_change_requests | branches | staff_branch_change_requests_current_branch_id_fkey | FOREIGN KEY (current_branch_id) REFERENCES branches(id) ON DELETE SET NULL |
| staff_branch_change_requests | qr_points | staff_branch_change_requests_qr_point_id_fkey | FOREIGN KEY (qr_point_id) REFERENCES qr_points(id) ON DELETE SET NULL |
| staff_branch_change_requests | branches | staff_branch_change_requests_requested_branch_id_fkey | FOREIGN KEY (requested_branch_id) REFERENCES branches(id) ON DELETE RESTRICT |
| staff_branch_change_requests | staff | staff_branch_change_requests_requested_by_staff_id_fkey | FOREIGN KEY (requested_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL |
| staff_branch_change_requests | staff | staff_branch_change_requests_reviewed_by_staff_id_fkey | FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL |
| staff_branch_change_requests | qr_scan_events | staff_branch_change_requests_scan_event_id_fkey | FOREIGN KEY (scan_event_id) REFERENCES qr_scan_events(id) ON DELETE SET NULL |
| staff_branch_change_requests | staff | staff_branch_change_requests_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE |
| staff_devices | branches | staff_devices_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| staff_devices | staff | staff_devices_revoked_by_fkey | FOREIGN KEY (revoked_by) REFERENCES staff(id) ON DELETE SET NULL |
| staff_devices | staff | staff_devices_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE |
| staff_location_snapshots | bookings | staff_location_snapshots_booking_id_fkey | FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE |
| staff_location_snapshots | branches | staff_location_snapshots_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) |
| staff_location_snapshots | staff | staff_location_snapshots_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE |
| staff_shift_checkins | branches | staff_shift_checkins_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| staff_shift_checkins | qr_scan_events | staff_shift_checkins_clock_in_scan_event_id_fkey | FOREIGN KEY (clock_in_scan_event_id) REFERENCES qr_scan_events(id) ON DELETE SET NULL |
| staff_shift_checkins | qr_scan_events | staff_shift_checkins_clock_out_scan_event_id_fkey | FOREIGN KEY (clock_out_scan_event_id) REFERENCES qr_scan_events(id) ON DELETE SET NULL |
| staff_shift_checkins | staff | staff_shift_checkins_recorded_by_fkey | FOREIGN KEY (recorded_by) REFERENCES staff(id) ON DELETE SET NULL |
| staff_shift_checkins | qr_points | staff_shift_checkins_source_qr_point_id_fkey | FOREIGN KEY (source_qr_point_id) REFERENCES qr_points(id) ON DELETE SET NULL |
| staff_shift_checkins | staff | staff_shift_checkins_staff_id_fkey | FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE |
| waitlist_requests | branches | waitlist_requests_branch_id_fkey | FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE |
| waitlist_requests | staff | waitlist_requests_contacted_by_fkey | FOREIGN KEY (contacted_by) REFERENCES staff(id) ON DELETE SET NULL |
| waitlist_requests | bookings | waitlist_requests_converted_to_booking_id_fkey | FOREIGN KEY (converted_to_booking_id) REFERENCES bookings(id) ON DELETE SET NULL |
| waitlist_requests | services | waitlist_requests_service_id_fkey | FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL |

## Preserved By Design

- auth.users
- public.staff
- public.staff_schedules
- public.staff_group_schedule_rules
- public.staff_schedule_groups
- public.staff_scheduling_preferences
- public.attendance_settings
- public.branches
- public.services
- public.branch_services
- public.branch_resources
- public.qr_points
- Active rows in public.staff_devices
- Weekly staff schedules in public.staff_schedules
- Auth users and staff identity records

## Apply Gate

Applying the reset would require this exact command after explicit approval:

```powershell
node scripts/maintenance/reset-crm-operational-data.mjs --apply --branch=all --confirmation=RESET-CRM-lsrbwqhvzjfpiabeolkv-all-20260711
```

The apply path exports backups to `maintenance-backups/crm-operational-reset/<timestamp>/`, takes the `cradlehub.crm_operational_reset` advisory lock, and runs in one transaction.
