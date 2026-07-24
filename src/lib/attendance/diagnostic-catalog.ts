import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceScanEvent,
} from "@/lib/attendance/types";

export type AttendanceDiagnosticOwner =
  | "automatic"
  | "staff"
  | "crm"
  | "manager"
  | "system"
  | "technical_support";

export type AttendanceDiagnosticPreventionOwner = Exclude<AttendanceDiagnosticOwner, "automatic">;

export type AttendanceDiagnosticResolutionKind =
  | "correct_record"
  | "resolve_scan"
  | "schedule"
  | "branch"
  | "phone"
  | "service"
  | "technical";

export type AttendanceDiagnostic = {
  code: string;
  category: "phone" | "branch" | "schedule" | "clock" | "service" | "technical";
  resolutionKind: AttendanceDiagnosticResolutionKind;
  severity: "info" | "warning" | "critical";
  attendanceChanged: boolean;
  resolutionOwner: AttendanceDiagnosticOwner;
  staffTitle: string;
  staffMessage: string;
  staffActionLabel: string;
  staffActionHref: string;
  staffCanResolve: boolean;
  staffPrevention: string;
  crmTitle: string;
  crmSummary: string;
  crmPrimaryAction: string;
  crmInstruction: string;
  immediateResolution: string;
  rootCause: string;
  preventionAction: string;
  preventionOwner: AttendanceDiagnosticPreventionOwner;
  verification: string;
};

type DiagnosticTemplate = Omit<AttendanceDiagnostic, "code">;

const template = (value: DiagnosticTemplate): DiagnosticTemplate => value;

const CATALOG = {
  phone_not_connected: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "This browser is not connected",
    staffMessage:
      "Sign in with your own staff account to connect this browser. Keep this page open; the original scan will continue automatically.",
    staffActionLabel: "Connect this browser",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: true,
    staffPrevention:
      "Use your normal browser and do not clear cookies, site data, site settings, or all browser storage.",
    crmTitle: "could not use their Attendance browser",
    crmSummary: "The browser did not present a trusted Attendance credential.",
    crmPrimaryAction: "Connect browser",
    crmInstruction:
      "Send a connection request to the Staff Profile or guide the staff member to sign in on the scanned browser.",
    immediateResolution: "Connect the current browser and resume the preserved scan.",
    rootCause: "The browser has never been connected to this staff profile.",
    preventionAction:
      "Confirm the staff member uses their normal browser and understands how to keep Attendance connected.",
    preventionOwner: "staff",
    verification: "Staff Profile shows Ready and one test scan succeeds from the same browser.",
  }),
  browser_connection_removed: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Browser connection removed",
    staffMessage:
      "This browser was connected before, but its secure Attendance connection is missing. Connect this browser again to continue.",
    staffActionLabel: "Connect this browser again",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: true,
    staffPrevention:
      "When clearing browser data, leave Cookies and site data, Site settings, and Clear storage unchecked.",
    crmTitle: "lost their Attendance browser connection",
    crmSummary: "The secure browser credential was removed or expired.",
    crmPrimaryAction: "Reconnect browser",
    crmInstruction:
      "Send a profile connection request. If this repeats, coach the staff member using browser-specific instructions.",
    immediateResolution: "Reconnect the current browser and resume the original scan.",
    rootCause: "Browser cookies or site storage were cleared, expired, or removed.",
    preventionAction:
      "Show browser-specific clearing instructions and monitor repeated reconnections for 30 days.",
    preventionOwner: "staff",
    verification: "The browser remains connected after closing and reopening the page.",
  }),
  phone_revoked: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "This phone is not approved",
    staffMessage: "CRM must review this phone before it can be used for Attendance.",
    staffActionLabel: "Ask CRM for help",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: false,
    staffPrevention: "Do not use another staff member’s phone or a phone that was reported lost.",
    crmTitle: "used a disconnected Attendance phone",
    crmSummary: "A revoked or security-blocked phone attempted a scan.",
    crmPrimaryAction: "Review phone access",
    crmInstruction:
      "Confirm ownership, then restore, replace, or keep the phone revoked. Never transfer ownership automatically.",
    immediateResolution: "Approve a safe replacement or restore the verified phone.",
    rootCause: "The phone was revoked, lost, stolen, shared, or security-blocked.",
    preventionAction: "Revoke old credentials and record the approved replacement decision.",
    preventionOwner: "crm",
    verification: "Only the approved phone remains active for the staff member.",
  }),
  device_limit_reached: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Phone limit reached",
    staffMessage: "Choose an old phone to replace or ask CRM to review your connected phones.",
    staffActionLabel: "Open phone setup",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: false,
    staffPrevention: "Report replacement phones before trying to connect another browser.",
    crmTitle: "reached the Attendance phone limit",
    crmSummary: "The account already has the maximum allowed active phones.",
    crmPrimaryAction: "Choose phone to replace",
    crmInstruction:
      "Confirm which old phone is no longer used, revoke it, then connect the current phone.",
    immediateResolution:
      "Revoke one verified old phone or approve an additional device according to policy.",
    rootCause: "Too many active phone credentials remain connected.",
    preventionAction: "Require an explicit replacement decision whenever a new phone is approved.",
    preventionOwner: "crm",
    verification: "The active phone count is within policy and the current phone is Ready.",
  }),
  wrong_staff_account: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Wrong staff account",
    staffMessage:
      "This browser is signed in as another staff member. Sign out and use your own account.",
    staffActionLabel: "Switch account",
    staffActionHref: "/login",
    staffCanResolve: true,
    staffPrevention: "Check that your own name is shown before completing Attendance.",
    crmTitle: "used the wrong staff account",
    crmSummary: "The signed-in account and the Attendance phone owner do not match.",
    crmPrimaryAction: "Review account ownership",
    crmInstruction:
      "Confirm whether this is a shared-phone problem, a wrong login, or a duplicate staff identity.",
    immediateResolution: "Sign out and reconnect using the correct staff account.",
    rootCause: "Another person’s login or browser profile was used.",
    preventionAction:
      "Remove saved shared credentials and show the signed-in staff name prominently.",
    preventionOwner: "staff",
    verification: "The browser owner and authenticated staff ID match.",
  }),
  wrong_branch: template({
    category: "branch",
    resolutionKind: "branch",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Branch needs confirmation",
    staffMessage:
      "This QR belongs to a different branch. Do not scan again until CRM confirms the correct branch.",
    staffActionLabel: "Request branch review",
    staffActionHref: "/staff-portal/notifications",
    staffCanResolve: false,
    staffPrevention: "Check the branch name shown on the scan page before submitting Attendance.",
    crmTitle: "scanned at a different branch",
    crmSummary: "Profile, schedule, temporary access, or QR branch does not agree.",
    crmPrimaryAction: "Correct branch",
    crmInstruction:
      "Compare profile, schedule, booking, QR, and temporary assignment branches. Approve today, transfer permanently, or reject the scan.",
    immediateResolution: "Apply the correct branch authority and resume or request one new scan.",
    rootCause: "Branch authority was missing, expired, or inconsistent.",
    preventionAction:
      "Create temporary access before the shift or update the permanent branch after transfer.",
    preventionOwner: "crm",
    verification: "Profile, schedule, booking, and Attendance branches agree for the next shift.",
  }),
  no_schedule: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your schedule needs confirmation",
    staffMessage:
      "The scan was saved, but no valid shift was found for today. Do not scan repeatedly.",
    staffActionLabel: "Review schedule",
    staffActionHref: "/staff-portal/schedule",
    staffCanResolve: false,
    staffPrevention:
      "Check your schedule before reporting for duty and notify CRM when it is missing.",
    crmTitle: "needs today’s schedule",
    crmSummary: "No weekly schedule or approved override matched the Attendance date.",
    crmPrimaryAction: "Add today’s schedule",
    crmInstruction:
      "Review weekly hours, overrides, bookings, branch hours, and the scan time. Add a one-day schedule or correct the permanent schedule.",
    immediateResolution:
      "Create or correct the verified shift, then process the preserved scan safely.",
    rootCause: "The weekly schedule, one-day override, or branch assignment was missing or wrong.",
    preventionAction: "Run a daily readiness check and assign an owner for incomplete schedules.",
    preventionOwner: "crm",
    verification: "The staff member has a valid schedule for their next expected duty.",
  }),
  off_day_scan: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Today is marked as your day off",
    staffMessage: "CRM will confirm whether this was approved extra work. Do not scan repeatedly.",
    staffActionLabel: "Review schedule",
    staffActionHref: "/staff-portal/schedule",
    staffCanResolve: false,
    staffPrevention: "Ask CRM or the manager to approve off-day work before starting duty.",
    crmTitle: "scanned on a scheduled day off",
    crmSummary: "The resolved schedule marks this date as off.",
    crmPrimaryAction: "Approve off-day work",
    crmInstruction:
      "Confirm the reason, then create a one-day schedule or reject the Attendance request.",
    immediateResolution:
      "Approve the extra duty and create the matching one-day shift, or reject the scan.",
    rootCause: "The staff member worked without an approved schedule override.",
    preventionAction: "Require off-day approval before assigning work or bookings.",
    preventionOwner: "manager",
    verification: "Any future off-day work has an approved override before the shift begins.",
  }),
  schedule_conflict: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Conflicting schedules found",
    staffMessage: "Attendance was not changed while CRM confirms the correct shift.",
    staffActionLabel: "Wait for CRM",
    staffActionHref: "/staff-portal/notifications",
    staffCanResolve: false,
    staffPrevention: "Report schedule changes before the shift begins.",
    crmTitle: "has conflicting shift windows",
    crmSummary: "More than one shift or override can apply to the scan.",
    crmPrimaryAction: "Choose correct shift",
    crmInstruction:
      "Keep the correct shift, remove the overlap, and rerun the scan interpretation.",
    immediateResolution: "Resolve the overlapping schedule windows before applying Attendance.",
    rootCause: "Weekly rules and overrides overlap or disagree.",
    preventionAction:
      "Validate schedules for overlaps whenever weekly hours or overrides are saved.",
    preventionOwner: "system",
    verification: "Only one effective shift applies to the staff member on the affected date.",
  }),
  duplicate_scan: template({
    category: "clock",
    resolutionKind: "resolve_scan",
    severity: "info",
    attendanceChanged: false,
    resolutionOwner: "automatic",
    staffTitle: "Scan already received",
    staffMessage: "The first scan is already being processed. Do not refresh or scan repeatedly.",
    staffActionLabel: "Wait for result",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Scan once, keep the page open, and wait for the final result.",
    crmTitle: "submitted a repeated scan",
    crmSummary: "The same Attendance action was received again.",
    crmPrimaryAction: "Ignore duplicate",
    crmInstruction:
      "Return the original result and close duplicate incidents without changing Attendance.",
    immediateResolution: "Ignore the repeated scan and keep the original committed result.",
    rootCause: "The QR was rescanned or the page was refreshed before the first result appeared.",
    preventionAction:
      "Show processing state, disable repeat actions, and coach only after repeated behavior.",
    preventionOwner: "system",
    verification: "No new Attendance record or duplicate incident was created.",
  }),
  scan_after_clock_out: template({
    category: "clock",
    resolutionKind: "resolve_scan",
    severity: "info",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Attendance is already complete",
    staffMessage: "A clock-out is already recorded. No change was made from this extra scan.",
    staffActionLabel: "View Attendance",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Do not scan again after the successful clock-out result appears.",
    crmTitle: "scanned after clock-out",
    crmSummary: "A later scan was received after the Attendance shift had already closed.",
    crmPrimaryAction: "Ignore duplicate",
    crmInstruction:
      "Keep the closed record unless evidence proves the later scan is the correct clock-out.",
    immediateResolution: "Ignore the extra scan or use it as a corrected clock-out after review.",
    rootCause: "The staff member scanned again after Attendance was already complete.",
    preventionAction:
      "Show the recorded clock-out time prominently and suppress repeated incidents.",
    preventionOwner: "system",
    verification:
      "The existing clock-out remains authoritative and the duplicate incident is closed.",
  }),
  ambiguous_saved_scan: template({
    category: "clock",
    resolutionKind: "resolve_scan",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your scan needs confirmation",
    staffMessage: "The scan time was saved. CRM will confirm whether it was clock-in or clock-out.",
    staffActionLabel: "Answer Attendance question",
    staffActionHref: "/staff-portal/notifications",
    staffCanResolve: false,
    staffPrevention: "Scan once when arriving and once immediately before leaving.",
    crmTitle: "has a saved scan awaiting a decision",
    crmSummary: "The scan is preserved, but its intended Attendance action is ambiguous.",
    crmPrimaryAction: "Decide clock-in or clock-out",
    crmInstruction:
      "Compare schedule, open records, prior scans, and active work before deciding the scan meaning.",
    immediateResolution:
      "Confirm clock-in, confirm clock-out, ignore duplicate, or request one new scan.",
    rootCause: "The record state and scan time did not provide one safe interpretation.",
    preventionAction:
      "Deliver problem-specific training and verify phone, schedule, and record readiness before the next shift.",
    preventionOwner: "crm",
    verification:
      "The final Attendance record matches the preserved scan and the issue is audited.",
  }),
  clock_in_review: template({
    category: "clock",
    resolutionKind: "correct_record",
    severity: "warning",
    attendanceChanged: true,
    resolutionOwner: "crm",
    staffTitle: "Clock-in needs confirmation",
    staffMessage: "Your clock-in was recorded and is waiting for CRM review.",
    staffActionLabel: "View Attendance",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Wait until the page confirms Clock-in before beginning work.",
    crmTitle: "has a clock-in to correct",
    crmSummary: "A recorded clock-in time needs confirmation or correction.",
    crmPrimaryAction: "Correct clock-in",
    crmInstruction:
      "Keep the scan time, use the scheduled start, enter another verified time, or void the record.",
    immediateResolution: "Save the verified clock-in time with an audit reason.",
    rootCause: "The scan time was late, early, unscheduled, or interpreted under a review rule.",
    preventionAction:
      "Confirm schedule readiness and reinforce waiting for the final clock-in result.",
    preventionOwner: "crm",
    verification:
      "The corrected clock-in and schedule agree and the staff can see the final record.",
  }),
  clock_out_review: template({
    category: "clock",
    resolutionKind: "correct_record",
    severity: "warning",
    attendanceChanged: true,
    resolutionOwner: "crm",
    staffTitle: "Clock-out needs confirmation",
    staffMessage: "Your clock-out was recorded and is waiting for CRM review.",
    staffActionLabel: "View Attendance",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Clock out immediately before leaving and wait for the confirmation screen.",
    crmTitle: "has a clock-out to correct",
    crmSummary: "A recorded clock-out time needs confirmation or correction.",
    crmPrimaryAction: "Correct clock-out",
    crmInstruction: "Use the scan, scheduled end, service completion, or another verified time.",
    immediateResolution: "Save the verified clock-out with a complete audit reason.",
    rootCause: "The clock-out was early, late, recovered, or inconsistent with the shift state.",
    preventionAction:
      "Send a reminder near expected clock-out and track repeated missed clock-outs.",
    preventionOwner: "system",
    verification: "The final clock-out and worked minutes are correct and visible to staff.",
  }),
  auto_close_confirmation: template({
    category: "clock",
    resolutionKind: "correct_record",
    severity: "warning",
    attendanceChanged: true,
    resolutionOwner: "crm",
    staffTitle: "Automatic clock-out needs confirmation",
    staffMessage:
      "The system closed your shift provisionally. CRM will confirm the final clock-out time.",
    staffActionLabel: "Confirm clock-out",
    staffActionHref: "/staff-portal/notifications",
    staffCanResolve: false,
    staffPrevention:
      "Clock out immediately before leaving instead of depending on automatic closing.",
    crmTitle: "has an auto-close to confirm",
    crmSummary: "The system auto-closed the shift and later evidence may change the final time.",
    crmPrimaryAction: "Confirm auto-close",
    crmInstruction:
      "Compare scheduled end, auto-close time, later scan, service completion, and closing policy.",
    immediateResolution:
      "Keep auto-close, use the later scan, enter a corrected time, or reopen the shift.",
    rootCause:
      "The staff member did not complete a confirmed clock-out before the closing intervention.",
    preventionAction:
      "Send clock-out reminders and escalate repeated forgotten clock-outs before auto-close.",
    preventionOwner: "system",
    verification:
      "The final clock-out is reconciled and the next shift does not require auto-close.",
  }),
  active_service: template({
    category: "service",
    resolutionKind: "service",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Complete the active service first",
    staffMessage: "An active service or trip must be completed before clock-out.",
    staffActionLabel: "Open active service",
    staffActionHref: "/staff-portal/service-progress",
    staffCanResolve: true,
    staffPrevention:
      "Use Start Service and Complete Service for every assigned customer before clock-out.",
    crmTitle: "has active work blocking clock-out",
    crmSummary: "A service, Home Service assignment, or trip remains active.",
    crmPrimaryAction: "Complete active work",
    crmInstruction: "Complete, extend, or correct the active assignment before allowing clock-out.",
    immediateResolution: "Finish or correct the active work, then retry clock-out.",
    rootCause: "The operational assignment was not completed before the Attendance action.",
    preventionAction: "Show active work in Attendance and remind staff near closing.",
    preventionOwner: "system",
    verification: "No active service or trip remains and clock-out succeeds.",
  }),
  attendance_state_mismatch: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "technical_support",
    staffTitle: "Attendance needs system review",
    staffMessage:
      "Your scan was saved. Do not scan repeatedly while CRM and technical support verify the record.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention:
      "Use only the official scan and correction tools; do not submit repeated scans.",
    crmTitle: "has an Attendance state mismatch",
    crmSummary: "Saved scans and the current Attendance record do not agree.",
    crmPrimaryAction: "Rebuild Attendance",
    crmInstruction:
      "Compare scans, corrections, and records. Rebuild safely or send the evidence to technical repair.",
    immediateResolution: "Restore the verified record state without discarding the saved scans.",
    rootCause: "A retry, auto-close, correction, or transaction left contradictory record state.",
    preventionAction:
      "Use atomic database actions, idempotent request IDs, and reconciliation tests.",
    preventionOwner: "technical_support",
    verification: "The record matches the scan timeline and the regression scenario passes.",
  }),
  invalid_qr: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Attendance QR not recognized",
    staffMessage: "Use the current official Attendance QR displayed at your branch.",
    staffActionLabel: "Scan official QR",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Use only the official branch Attendance QR, not a room or old poster.",
    crmTitle: "used an invalid or inactive QR",
    crmSummary: "The QR is missing, inactive, the wrong type, or assigned to an invalid branch.",
    crmPrimaryAction: "Repair QR",
    crmInstruction: "Activate, replace, or correct the QR configuration and remove old posters.",
    immediateResolution:
      "Repair the QR configuration or direct the staff member to the current poster.",
    rootCause: "An old, inactive, wrong-type, or misconfigured QR was scanned.",
    preventionAction: "Run a daily QR readiness check and retire superseded posters.",
    preventionOwner: "crm",
    verification: "The official QR resolves to the correct active Attendance point and branch.",
  }),
  network_error: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Internet connection interrupted",
    staffMessage: "Reconnect Wi-Fi or mobile data, then retry once from this same page.",
    staffActionLabel: "Retry once",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Confirm Wi-Fi or mobile data before scanning and do not refresh repeatedly.",
    crmTitle: "had a network interruption",
    crmSummary: "The device could not reach Attendance or the request timed out.",
    crmPrimaryAction: "Check connection",
    crmInstruction:
      "Confirm whether the original request committed before asking for one safe retry.",
    immediateResolution:
      "Return the original result when available or retry the same request once.",
    rootCause: "The phone or branch network was unavailable or unstable.",
    preventionAction: "Provide reliable branch Wi-Fi and preserve idempotent retries.",
    preventionOwner: "manager",
    verification: "The same request returns one authoritative result without duplicate Attendance.",
  }),
  inactive_staff: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Staff account inactive",
    staffMessage:
      "Your account is not currently allowed to use Attendance. Contact CRM or management.",
    staffActionLabel: "Ask CRM for help",
    staffActionHref: "/staff-portal/profile",
    staffCanResolve: false,
    staffPrevention: "Use only your active staff account.",
    crmTitle: "has an inactive Attendance account",
    crmSummary: "The staff account is inactive, archived, or merged.",
    crmPrimaryAction: "Review staff access",
    crmInstruction:
      "Confirm employment and identity status before reactivating or rejecting Attendance.",
    immediateResolution: "Reactivate the verified profile or keep the Attendance request rejected.",
    rootCause: "The account is inactive, archived, or linked to a merged staff identity.",
    preventionAction: "Keep staff lifecycle and auth linkage synchronized.",
    preventionOwner: "crm",
    verification: "One canonical active profile is linked to the correct login account.",
  }),
  new_phone_detected: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "New phone detected",
    staffMessage:
      "This browser appears to be on a new phone. Sign in with your own staff account and request connection approval.",
    staffActionLabel: "Request phone connection",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: true,
    staffPrevention:
      "Request a replacement before using a new phone and never share your connected browser.",
    crmTitle: "is connecting a new Attendance phone",
    crmSummary: "The current browser is not one of the staff member’s approved Attendance devices.",
    crmPrimaryAction: "Approve replacement phone",
    crmInstruction:
      "Verify the staff identity, decide whether to revoke the previous phone, then approve or reject the new connection.",
    immediateResolution:
      "Approve the new phone or reconnect the known phone, then resume the saved scan.",
    rootCause: "The staff member changed phones or opened Attendance on a different device.",
    preventionAction:
      "Record replacement-phone ownership and revoke lost or retired devices before the next shift.",
    preventionOwner: "crm",
    verification: "The approved phone shows Ready and the previous device has the intended status.",
  }),
  private_browser_detected: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Private browsing cannot stay connected",
    staffMessage:
      "Attendance cannot keep a secure phone connection in private or incognito mode. Open the QR in your normal browser.",
    staffActionLabel: "Open normal browser",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: true,
    staffPrevention: "Use the normal browser profile for every Attendance scan.",
    crmTitle: "used private browsing for Attendance",
    crmSummary: "Private browsing removes the secure device connection when the tab closes.",
    crmPrimaryAction: "Guide normal-browser use",
    crmInstruction:
      "Ask the staff member to reopen the official QR in a normal browser and connect that browser.",
    immediateResolution: "Open the official QR in a normal browser and reconnect it.",
    rootCause: "The QR was opened in private or incognito browsing mode.",
    preventionAction:
      "Show browser-specific instructions for using a normal browser and confirm the correct browser is used.",
    preventionOwner: "staff",
    verification:
      "A normal-browser test scan preserves the connection after the page is closed and reopened.",
  }),
  cookies_disabled: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Browser storage is blocked",
    staffMessage:
      "This browser is blocking the secure Attendance connection. Allow cookies and site storage for CradleHub, then retry once.",
    staffActionLabel: "Show browser instructions",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: true,
    staffPrevention: "Keep cookies and site storage enabled for CradleHub.",
    crmTitle: "has browser storage blocked",
    crmSummary: "The browser cannot store the secure Attendance device credential.",
    crmPrimaryAction: "Guide browser settings",
    crmInstruction:
      "Use the detected browser instructions, then verify one reconnect and one test scan.",
    immediateResolution:
      "Enable site storage, reconnect the browser, and resume the preserved scan.",
    rootCause: "Cookies or site storage are disabled or blocked.",
    preventionAction:
      "Allow CradleHub site storage and avoid privacy tools that erase it after every session.",
    preventionOwner: "staff",
    verification: "The device remains Ready after closing and reopening the browser.",
  }),
  device_connected_other_staff: template({
    category: "phone",
    resolutionKind: "phone",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "This browser belongs to another staff profile",
    staffMessage:
      "Do not continue with this account. Sign out and use your own staff account, or ask CRM to review the phone.",
    staffActionLabel: "Ask CRM to review",
    staffActionHref: "/staff-portal/profile#attendance-phone",
    staffCanResolve: false,
    staffPrevention: "Do not exchange connected browser profiles between staff members.",
    crmTitle: "used a browser connected to another staff member",
    crmSummary: "The current device credential and signed-in staff identity do not match.",
    crmPrimaryAction: "Review phone ownership",
    crmInstruction:
      "Verify both staff identities before revoking, transferring, or rejecting the connection. Never transfer automatically.",
    immediateResolution:
      "Use the correct account and approved device, or perform a verified CRM transfer.",
    rootCause:
      "A shared phone, saved login, or reused browser profile belongs to another staff member.",
    preventionAction:
      "Register approved shared devices explicitly and coach staff not to exchange browser profiles.",
    preventionOwner: "crm",
    verification: "The current browser owner, signed-in account, and staff profile all match.",
  }),
  account_not_linked: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your account needs profile setup",
    staffMessage:
      "Your login could not be matched to one active staff profile. CRM has been notified. Do not scan repeatedly.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/profile",
    staffCanResolve: false,
    staffPrevention: "Use only the staff account provided for your own profile.",
    crmTitle: "has an unlinked Attendance account",
    crmSummary: "The authenticated account is not linked to one canonical active staff profile.",
    crmPrimaryAction: "Link staff account",
    crmInstruction:
      "Verify identity, link the auth account to the canonical staff record, and remove duplicate linkage.",
    immediateResolution: "Link the correct auth account and resume or reconcile the saved scan.",
    rootCause: "The staff auth account and operational staff profile are not linked.",
    preventionAction: "Include auth linkage in onboarding and readiness checks.",
    preventionOwner: "crm",
    verification: "Exactly one active canonical staff profile resolves for the login account.",
  }),
  duplicate_staff_identity: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "technical_support",
    staffTitle: "Your staff identity needs review",
    staffMessage:
      "More than one staff profile may represent your account. CRM will confirm the correct profile. Do not scan again.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Wait for CRM confirmation before attempting another Attendance scan.",
    crmTitle: "has duplicate staff identity records",
    crmSummary:
      "Multiple records may represent the same person or share conflicting auth/device ownership.",
    crmPrimaryAction: "Review and merge identity",
    crmInstruction:
      "Select the canonical staff record, migrate references safely, and archive duplicates with audit evidence.",
    immediateResolution:
      "Repair identity first, then reconcile the preserved scan against the canonical profile.",
    rootCause: "Duplicate or conflicting staff records were created.",
    preventionAction:
      "Enforce canonical identity checks during onboarding, transfer, reactivation, and merge operations.",
    preventionOwner: "technical_support",
    verification:
      "One canonical profile owns auth, schedules, devices, bookings, and Attendance history.",
  }),
  branch_assignment_mismatch: template({
    category: "branch",
    resolutionKind: "branch",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your branch assignment needs confirmation",
    staffMessage:
      "Your profile, schedule, booking, or scanned branch do not agree. Your scan was saved for CRM review.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention:
      "Check the branch name before scanning and confirm temporary assignments before duty.",
    crmTitle: "has conflicting branch assignments",
    crmSummary: "Profile, schedule, booking, QR, or temporary access point to different branches.",
    crmPrimaryAction: "Correct branch assignment",
    crmInstruction:
      "Compare every branch source, then apply temporary access, permanent transfer, schedule correction, or rejection.",
    immediateResolution: "Choose the authoritative branch and safely reconcile the scan.",
    rootCause: "Branch information was not synchronized before the shift.",
    preventionAction:
      "Run branch-consistency readiness checks before schedules and bookings become active.",
    preventionOwner: "crm",
    verification: "Profile, effective schedule, booking, QR, and approved access agree.",
  }),
  temporary_branch_access_expired: template({
    category: "branch",
    resolutionKind: "branch",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Temporary branch access expired",
    staffMessage:
      "Your temporary approval for this branch is no longer active. Your scan was saved for CRM.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Confirm temporary branch approval before reporting for duty.",
    crmTitle: "has expired temporary branch access",
    crmSummary:
      "The scanned branch was previously approved, but the authorization window has ended.",
    crmPrimaryAction: "Renew branch access",
    crmInstruction:
      "Extend access for the shift or business day, create a new approval, or reject the scan.",
    immediateResolution: "Renew valid access or reject the wrong-branch scan.",
    rootCause: "Temporary branch authorization was not renewed for the current duty.",
    preventionAction: "Create temporary access together with the schedule and booking assignment.",
    preventionOwner: "crm",
    verification: "The authorization covers the intended shift and business date.",
  }),
  split_shift_gap: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your scan was between scheduled shifts",
    staffMessage:
      "The scan time falls in a gap between two schedule windows. CRM will confirm whether this was approved extra work.",
    staffActionLabel: "View today’s schedule",
    staffActionHref: "/staff-portal/schedule",
    staffCanResolve: false,
    staffPrevention: "Check every shift window and ask CRM before working during a schedule gap.",
    crmTitle: "scanned during a split-shift gap",
    crmSummary: "The scan is outside both effective schedule windows but between them.",
    crmPrimaryAction: "Approve extra shift window",
    crmInstruction:
      "Add a temporary window, approve extra work, correct the schedule, or reject the scan.",
    immediateResolution: "Create the approved schedule window before applying Attendance.",
    rootCause: "The staff member worked between split-shift windows without a matching override.",
    preventionAction:
      "Require temporary schedule approval before assigning work in a split-shift gap.",
    preventionOwner: "crm",
    verification: "The effective schedule contains the approved work window.",
  }),
  schedule_override_conflict: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Today’s schedules conflict",
    staffMessage:
      "A weekly schedule and a one-day change disagree. CRM will confirm the correct schedule.",
    staffActionLabel: "View today’s schedule",
    staffActionHref: "/staff-portal/schedule",
    staffCanResolve: false,
    staffPrevention: "Confirm the final schedule in your portal before reporting for duty.",
    crmTitle: "has conflicting schedule sources",
    crmSummary: "The weekly schedule and date override produce incompatible Attendance windows.",
    crmPrimaryAction: "Choose effective schedule",
    crmInstruction:
      "Use the intended override, restore the weekly schedule, or correct the one-day record.",
    immediateResolution: "Resolve the effective schedule source, then reconcile the saved scan.",
    rootCause: "A schedule override was incomplete, stale, or contradictory.",
    preventionAction:
      "Validate overrides when created and show the final effective schedule to staff.",
    preventionOwner: "crm",
    verification: "One effective schedule source is authoritative for the business date.",
  }),
  overnight_schedule_ambiguous: template({
    category: "schedule",
    resolutionKind: "schedule",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Overnight shift needs confirmation",
    staffMessage:
      "The scan is near the Attendance day boundary and could match more than one shift. CRM will confirm it.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention:
      "Use the same branch QR and wait for the confirmed result on overnight duties.",
    crmTitle: "has an ambiguous overnight shift",
    crmSummary: "The scan may belong to the previous business day or current business day.",
    crmPrimaryAction: "Choose overnight shift",
    crmInstruction:
      "Compare schedule source, boundary, earlier scans, active service, and booking evidence before deciding.",
    immediateResolution: "Attach the scan to the verified overnight shift.",
    rootCause: "The effective schedule crosses the Attendance business-day boundary.",
    preventionAction:
      "Use date-aware overnight schedule keys and test boundary behavior before deployment.",
    preventionOwner: "technical_support",
    verification:
      "The same overnight pattern resolves deterministically at the configured boundary.",
  }),
  request_replayed: template({
    category: "clock",
    resolutionKind: "resolve_scan",
    severity: "info",
    attendanceChanged: false,
    resolutionOwner: "automatic",
    staffTitle: "This scan was already processed",
    staffMessage:
      "The same scan request was received again. The system will show the original result.",
    staffActionLabel: "View original result",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Scan once, keep the page open, and wait for the final result.",
    crmTitle: "replayed an existing scan request",
    crmSummary: "An identical request ID was submitted more than once.",
    crmPrimaryAction: "Use original result",
    crmInstruction:
      "Do not create another incident or Attendance mutation; return the recorded operation result.",
    immediateResolution: "Return the idempotent original result.",
    rootCause: "The page retried or refreshed the same scan request.",
    preventionAction:
      "Keep request IDs stable across retries and disable repeat submission while processing.",
    preventionOwner: "system",
    verification: "Repeated submission returns exactly the original outcome and no duplicate row.",
  }),
  multiple_open_records: template({
    category: "technical",
    resolutionKind: "correct_record",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "Your Attendance records need correction",
    staffMessage:
      "More than one active Attendance record was found. CRM will correct the records before another scan.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Wait for CRM confirmation and do not scan repeatedly.",
    crmTitle: "has multiple open Attendance records",
    crmSummary: "More than one active shift exists for the same staff and business date.",
    crmPrimaryAction: "Merge or close duplicate",
    crmInstruction:
      "Keep the verified record, merge evidence when safe, and void or close the duplicate with audit history.",
    immediateResolution: "Resolve duplicate active records before processing the saved scan.",
    rootCause:
      "A retry, manual correction, or non-atomic operation created overlapping active records.",
    preventionAction:
      "Enforce one active shift with atomic RPCs, row locks, idempotency, and database constraints.",
    preventionOwner: "technical_support",
    verification: "Concurrent and replay tests cannot create a second active record.",
  }),
  no_open_record_for_clock_out: template({
    category: "clock",
    resolutionKind: "correct_record",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "No clock-in record was found",
    staffMessage:
      "The system could not find an open Attendance record for this clock-out. CRM will confirm the missing record.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention:
      "After arriving, wait until the page confirms your clock-in before starting work.",
    crmTitle: "has a clock-out without an open record",
    crmSummary: "A likely clock-out scan has no active shift to close.",
    crmPrimaryAction: "Create or link missing clock-in",
    crmInstruction:
      "Inspect earlier scans, branch, schedule, and closed records before creating or linking a shift.",
    immediateResolution: "Restore or create the verified clock-in, then apply the clock-out.",
    rootCause:
      "The clock-in failed, was never attempted, used another branch, or the record closed incorrectly.",
    preventionAction:
      "Show current Attendance status and alert CRM when scheduled staff remain unclocked.",
    preventionOwner: "crm",
    verification: "The next shift shows a confirmed clock-in before work begins.",
  }),
  service_finished_attendance_open: template({
    category: "service",
    resolutionKind: "service",
    severity: "info",
    attendanceChanged: true,
    resolutionOwner: "staff",
    staffTitle: "Service finished; Attendance is still open",
    staffMessage:
      "Completing a service does not automatically clock you out. Scan the Attendance QR immediately before leaving.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Complete the service first, then scan Attendance immediately before leaving.",
    crmTitle: "finished service with Attendance still open",
    crmSummary: "The booking is complete but the staff shift remains active.",
    crmPrimaryAction: "Wait for clock-out scan",
    crmInstruction:
      "Normally keep Attendance open; use service completion as clock-out only with an audited correction.",
    immediateResolution: "Have staff scan out, or apply a verified corrected clock-out.",
    rootCause: "Service completion and Attendance clock-out are separate actions.",
    preventionAction:
      "Show a clock-out reminder after the final service and near expected shift end.",
    preventionOwner: "system",
    verification: "The staff completes service and records a confirmed clock-out before leaving.",
  }),
  home_service_active: template({
    category: "service",
    resolutionKind: "service",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Home Service is still active",
    staffMessage:
      "Your trip or Home Service session is not complete. Finish the service and return flow before clocking out.",
    staffActionLabel: "Open active Home Service",
    staffActionHref: "/staff-portal/jobs/active",
    staffCanResolve: true,
    staffPrevention:
      "Complete travel, arrival, service, and return steps before Attendance clock-out.",
    crmTitle: "has an active Home Service during clock-out",
    crmSummary: "The Home Service operational workflow is still active.",
    crmPrimaryAction: "Complete or correct Home Service",
    crmInstruction:
      "Verify travel, service, return, staff assignment, and driver status before allowing clock-out.",
    immediateResolution: "Finish or correct the Home Service workflow, then retry clock-out.",
    rootCause: "The operational Home Service state was not completed.",
    preventionAction: "Show active job steps in Attendance and send return/completion reminders.",
    preventionOwner: "staff",
    verification: "The job is completed or returned and clock-out succeeds without override.",
  }),
  driver_trip_active: template({
    category: "service",
    resolutionKind: "service",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Driver trip is still active",
    staffMessage:
      "The assigned trip has not been completed or returned. Finish the trip before clocking out.",
    staffActionLabel: "Open active trip",
    staffActionHref: "/driver/jobs",
    staffCanResolve: true,
    staffPrevention: "Record arrival and return before ending Attendance.",
    crmTitle: "has an active driver trip during clock-out",
    crmSummary: "The driver’s operational trip remains open.",
    crmPrimaryAction: "Complete or correct trip",
    crmInstruction:
      "Verify travel progress and return time before allowing or correcting clock-out.",
    immediateResolution: "Complete the trip or record the verified return, then clock out.",
    rootCause: "The driver trip lifecycle was not completed.",
    preventionAction: "Add return reminders and show active trip status on the Attendance result.",
    preventionOwner: "staff",
    verification: "The trip is complete and Attendance clock-out succeeds.",
  }),
  request_timeout: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Attendance is taking too long",
    staffMessage:
      "The server did not respond in time. Keep this page open and retry once using the same receipt.",
    staffActionLabel: "Retry saved request",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Confirm mobile data or Wi-Fi before scanning and do not refresh repeatedly.",
    crmTitle: "has a timed-out Attendance request",
    crmSummary: "The client did not receive a final result before the timeout.",
    crmPrimaryAction: "Check saved result",
    crmInstruction:
      "Look up the request receipt before asking the staff member to retry. Never create a second mutation blindly.",
    immediateResolution: "Return the saved operation result or retry idempotently once.",
    rootCause: "Network latency or server response time exceeded the client timeout.",
    preventionAction:
      "Use stable request IDs, safe retry, offline detection, and branch connectivity checks.",
    preventionOwner: "system",
    verification: "A retry returns one authoritative result without duplicate Attendance.",
  }),
  stale_app_version: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "Attendance page is out of date",
    staffMessage:
      "Refresh once to load the latest Attendance system. Your saved receipt will remain available.",
    staffActionLabel: "Refresh safely",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention:
      "Use the latest saved Attendance page and avoid keeping old tabs open for many days.",
    crmTitle: "used a stale Attendance application",
    crmSummary: "The browser loaded an older client contract than the deployed server.",
    crmPrimaryAction: "Refresh current app",
    crmInstruction:
      "Confirm the deployment is healthy, then guide one safe refresh without repeating the scan.",
    immediateResolution: "Load the current app and recover the saved request result.",
    rootCause: "A stale cached page or long-lived browser tab used an old application contract.",
    preventionAction:
      "Use deployment version checks and safe refresh prompts that preserve request receipts.",
    preventionOwner: "system",
    verification: "The refreshed page reports the current version and resolves the saved result.",
  }),
  database_function_missing: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "technical_support",
    staffTitle: "Attendance needs technical repair",
    staffMessage:
      "A required Attendance operation is unavailable. Your receipt was saved; do not scan repeatedly.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Keep the receipt and wait for a confirmed result.",
    crmTitle: "is blocked by a missing database operation",
    crmSummary:
      "The deployed source expects a database RPC that is absent or not visible in the schema cache.",
    crmPrimaryAction: "Repair database contract",
    crmInstruction:
      "Deploy the tracked migration, reload schema cache, verify grants, reconcile the saved scan, and add regression coverage.",
    immediateResolution: "Restore the required function and reconcile today’s saved scan.",
    rootCause: "Application and database migration state drifted.",
    preventionAction:
      "Gate deployments on migration history, RPC signature checks, schema-cache reload, and live smoke tests.",
    preventionOwner: "technical_support",
    verification:
      "The exact RPC signature is callable in production and the scenario passes end to end.",
  }),
  permission_policy_error: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "technical_support",
    staffTitle: "Attendance permission could not be verified",
    staffMessage:
      "The system could not safely authorize this Attendance action. Your receipt was saved.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Do not repeat the scan until CRM confirms the result.",
    crmTitle: "has an Attendance authorization failure",
    crmSummary:
      "The authenticated identity, role, branch, RLS policy, or RPC authorization rejected the operation.",
    crmPrimaryAction: "Repair authorization",
    crmInstruction:
      "Verify identity linkage, role, branch scope, grants, and policy before reconciling Attendance.",
    immediateResolution:
      "Correct authorization and safely replay or reconcile the preserved operation.",
    rootCause:
      "The deployed permission contract does not match the intended operational role or identity.",
    preventionAction:
      "Add role-and-branch authorization tests for every Attendance RPC and workspace.",
    preventionOwner: "technical_support",
    verification: "The intended role succeeds and unauthorized roles remain blocked.",
  }),
  inactive_qr: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "crm",
    staffTitle: "This Attendance QR is inactive",
    staffMessage: "Use the current official Attendance QR at your branch. CRM has been notified.",
    staffActionLabel: "View Attendance status",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention: "Scan only the current official branch Attendance poster.",
    crmTitle: "scanned an inactive Attendance QR",
    crmSummary: "The QR point exists but is no longer active.",
    crmPrimaryAction: "Replace or activate QR",
    crmInstruction:
      "Confirm whether the poster is obsolete, activate the intended point, or generate and print a replacement.",
    immediateResolution:
      "Restore the official QR configuration or direct staff to the current poster.",
    rootCause: "An obsolete or deactivated QR poster remains in use.",
    preventionAction: "Run QR readiness checks and remove retired posters immediately.",
    preventionOwner: "crm",
    verification:
      "The displayed poster resolves to one active Attendance QR for the correct branch.",
  }),
  wrong_qr_type: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "warning",
    attendanceChanged: false,
    resolutionOwner: "staff",
    staffTitle: "This QR is not for Attendance",
    staffMessage:
      "You scanned a room or resource QR. Scan the official Attendance QR at the branch.",
    staffActionLabel: "View Attendance help",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Check the poster label before scanning.",
    crmTitle: "scanned the wrong QR type",
    crmSummary: "A valid CradleHub QR was used, but it is not an Attendance point.",
    crmPrimaryAction: "Guide correct QR",
    crmInstruction:
      "Confirm posters are clearly labelled and positioned so room/resource codes are not confused with Attendance.",
    immediateResolution: "Scan the official Attendance QR once.",
    rootCause: "QR posters were confused or labelled unclearly.",
    preventionAction:
      "Use strong visual labels and separate Attendance posters from room/resource QR codes.",
    preventionOwner: "crm",
    verification: "Staff selects the correct labelled QR without assistance.",
  }),
  test_mode_scan: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "info",
    attendanceChanged: false,
    resolutionOwner: "automatic",
    staffTitle: "Test Attendance only",
    staffMessage: "This scan was recorded as test data. No live Attendance change was made.",
    staffActionLabel: "View test result",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Use test mode only during approved training or diagnostics.",
    crmTitle: "created a test Attendance scan",
    crmSummary: "The event belongs to test mode and must remain separate from live operations.",
    crmPrimaryAction: "Archive test incident",
    crmInstruction:
      "Verify the test marker, keep it out of live counts, and archive it when training is complete.",
    immediateResolution: "Keep the event in test data and close any live-facing incident.",
    rootCause: "Attendance test mode was enabled for training or diagnostics.",
    preventionAction:
      "Display test mode prominently and prevent test rows from entering live work queues.",
    preventionOwner: "system",
    verification: "Live dashboards and payroll exclude the test event.",
  }),
  incident_already_resolved: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "info",
    attendanceChanged: true,
    resolutionOwner: "automatic",
    staffTitle: "This Attendance issue is already resolved",
    staffMessage:
      "The underlying Attendance record has already been corrected. No further action is required.",
    staffActionLabel: "View Attendance history",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: true,
    staffPrevention: "Use the latest Attendance status instead of reopening an old notification.",
    crmTitle: "has an obsolete resolved incident",
    crmSummary:
      "The notification or queue row remains open after the underlying record was corrected.",
    crmPrimaryAction: "Close obsolete incident",
    crmInstruction:
      "Verify the correction and automatically close duplicate notifications, tasks, and incidents.",
    immediateResolution: "Close the stale incident without changing Attendance again.",
    rootCause: "Resolution status was not synchronized across related workflow records.",
    preventionAction:
      "Resolve related notifications and tasks atomically when the incident closes.",
    preventionOwner: "system",
    verification: "No resolved incident remains in the active CRM queue.",
  }),
  technical_failure: template({
    category: "technical",
    resolutionKind: "technical",
    severity: "critical",
    attendanceChanged: false,
    resolutionOwner: "technical_support",
    staffTitle: "Attendance needs technical repair",
    staffMessage:
      "Your scan receipt was saved. Do not scan repeatedly while support verifies the result.",
    staffActionLabel: "Copy support details",
    staffActionHref: "/staff-portal/attendance",
    staffCanResolve: false,
    staffPrevention:
      "Keep the support receipt and wait for a confirmed result before scanning again.",
    crmTitle: "has a technical Attendance failure",
    crmSummary: "A required database action, permission, or application contract failed.",
    crmPrimaryAction: "Open technical repair",
    crmInstruction:
      "Preserve evidence, correct today’s record only after verification, and require a permanent repair plus regression test.",
    immediateResolution:
      "Protect the record, repair the system contract, then reconcile the saved scan.",
    rootCause:
      "A database function, permission policy, schema contract, or server operation failed.",
    preventionAction:
      "Deploy the permanent fix, add a regression test, and monitor the same safe error code.",
    preventionOwner: "technical_support",
    verification:
      "The same scenario passes in the deployed environment and Attendance is reconciled.",
  }),
} satisfies Record<string, DiagnosticTemplate>;

const CODE_ALIASES: Record<string, keyof typeof CATALOG> = {
  unknown_device: "phone_not_connected",
  device_not_registered: "phone_not_connected",
  missing_device: "phone_not_connected",
  unregistered_device: "phone_not_connected",
  first_time_device_registration: "phone_not_connected",
  browser_data_cleared: "browser_connection_removed",
  device_cookie_missing: "browser_connection_removed",
  device_cookie_expired: "browser_connection_removed",
  device_recovery_required: "browser_connection_removed",
  revoked_device: "phone_revoked",
  device_revoked: "phone_revoked",
  security_blocked_device: "phone_revoked",
  device_limit_reached: "device_limit_reached",
  device_staff_mismatch: "wrong_staff_account",
  device_linked_to_other_staff: "wrong_staff_account",
  wrong_staff_account: "wrong_staff_account",
  wrong_branch: "wrong_branch",
  branch_assignment_issue: "wrong_branch",
  missing_schedule: "no_schedule",
  no_schedule: "no_schedule",
  no_schedule_configured: "no_schedule",
  unscheduled: "no_schedule",
  off_day_scan: "off_day_scan",
  off_day_exception: "off_day_scan",
  schedule_conflict: "schedule_conflict",
  shift_conflict: "schedule_conflict",
  duplicate_scan: "duplicate_scan",
  duplicate_scan_debounced: "duplicate_scan",
  already_processed: "duplicate_scan",
  already_checked_out: "scan_after_clock_out",
  scan_after_clock_out: "scan_after_clock_out",
  likely_closing_scan_without_clock_in: "ambiguous_saved_scan",
  ambiguous_scan: "ambiguous_saved_scan",
  saved_scan: "ambiguous_saved_scan",
  late_clock_in: "clock_in_review",
  early_clock_in: "clock_in_review",
  clock_in_review: "clock_in_review",
  early_clock_out: "clock_out_review",
  overtime_clock_out: "clock_out_review",
  clock_out_review: "clock_out_review",
  missed_checkout: "auto_close_confirmation",
  auto_close_confirmation_required: "auto_close_confirmation",
  provisional_auto_close: "auto_close_confirmation",
  active_service: "active_service",
  active_service_blocks_clock_out: "active_service",
  active_trip_blocks_clock_out: "active_service",
  stale_open_checkin: "attendance_state_mismatch",
  conflicting_open_checkin: "attendance_state_mismatch",
  attendance_state_mismatch: "attendance_state_mismatch",
  invalid_qr: "invalid_qr",
  invalid_qr_point: "invalid_qr",
  network_error: "network_error",
  offline: "network_error",
  inactive_staff: "inactive_staff",
  new_phone: "new_phone_detected",
  new_phone_detected: "new_phone_detected",
  replacement_phone: "new_phone_detected",
  private_browser: "private_browser_detected",
  incognito: "private_browser_detected",
  private_mode: "private_browser_detected",
  cookies_disabled: "cookies_disabled",
  site_storage_blocked: "cookies_disabled",
  device_connected_to_another_staff: "device_connected_other_staff",
  device_owner_mismatch: "device_connected_other_staff",
  account_not_linked: "account_not_linked",
  staff_account_not_linked: "account_not_linked",
  duplicate_staff_identity: "duplicate_staff_identity",
  duplicate_staff_profile: "duplicate_staff_identity",
  branch_assignment_mismatch: "branch_assignment_mismatch",
  temporary_branch_access_expired: "temporary_branch_access_expired",
  split_shift_gap: "split_shift_gap",
  schedule_override_conflict: "schedule_override_conflict",
  overnight_schedule_ambiguous: "overnight_schedule_ambiguous",
  request_replayed: "request_replayed",
  scan_request_replayed: "request_replayed",
  multiple_open_records: "multiple_open_records",
  multiple_open_attendance_records: "multiple_open_records",
  no_open_record_for_clock_out: "no_open_record_for_clock_out",
  missing_open_checkin: "no_open_record_for_clock_out",
  service_finished_attendance_open: "service_finished_attendance_open",
  home_service_active: "home_service_active",
  home_service_still_active: "home_service_active",
  driver_trip_active: "driver_trip_active",
  driver_trip_still_active: "driver_trip_active",
  request_timeout: "request_timeout",
  stale_app_version: "stale_app_version",
  client_version_stale: "stale_app_version",
  database_function_missing: "database_function_missing",
  rpc_missing: "database_function_missing",
  schema_cache_function_missing: "database_function_missing",
  permission_policy_error: "permission_policy_error",
  rls_error: "permission_policy_error",
  not_authorized: "permission_policy_error",
  inactive_qr: "inactive_qr",
  wrong_qr_type: "wrong_qr_type",
  test_mode_scan: "test_mode_scan",
  test_scan: "test_mode_scan",
  incident_already_resolved: "incident_already_resolved",
  already_resolved: "incident_already_resolved",
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_") ?? "";
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function messageCode(message: string): keyof typeof CATALOG | null {
  const value = message.toLowerCase();
  if (value.includes("private browser") || value.includes("incognito")) {
    return "private_browser_detected";
  }
  if (value.includes("cookies disabled") || value.includes("site storage blocked")) {
    return "cookies_disabled";
  }
  if (value.includes("multiple open") && value.includes("attendance")) {
    return "multiple_open_records";
  }
  if (value.includes("no open") && value.includes("clock-out")) {
    return "no_open_record_for_clock_out";
  }
  if (
    value.includes("function") &&
    (value.includes("schema cache") || value.includes("does not exist"))
  ) {
    return "database_function_missing";
  }
  if (value.includes("not authorized") || value.includes("permission policy")) {
    return "permission_policy_error";
  }
  if (value.includes("scanned again after") && value.includes("shift was closed")) {
    return "scan_after_clock_out";
  }
  if (value.includes("auto-closed") || value.includes("auto closed")) {
    return "auto_close_confirmation";
  }
  if (
    value.includes("sole open attendance record was closed") ||
    value.includes("attendance state") ||
    value.includes("record state") ||
    value.includes("closed even though")
  ) {
    return "attendance_state_mismatch";
  }
  if (value.includes("clock-in needs review") || value.includes("clock in needs review")) {
    return "clock_in_review";
  }
  if (value.includes("clock-out needs review") || value.includes("clock out needs review")) {
    return "clock_out_review";
  }
  if (value.includes("day off")) return "off_day_scan";
  if (value.includes("schedule")) return "no_schedule";
  if (value.includes("active service") || value.includes("active assignment")) {
    return "active_service";
  }
  if (value.includes("browser data") || value.includes("cookie")) {
    return "browser_connection_removed";
  }
  if (value.includes("unregistered device") || value.includes("phone not connected")) {
    return "phone_not_connected";
  }
  if (value.includes("different branch") || value.includes("wrong branch")) {
    return "wrong_branch";
  }
  if (value.includes("duplicate") || value.includes("repeated scan")) {
    return "duplicate_scan";
  }
  return null;
}

export function recurrenceLevel(count: number): {
  label: string;
  guidance: string;
  requiresFollowUp: boolean;
} {
  if (count >= 4) {
    return {
      label: "Repeated pattern",
      guidance: "Create a manager prevention task and verify the fix during the next shift.",
      requiresFollowUp: true,
    };
  }
  if (count === 3) {
    return {
      label: "Third occurrence",
      guidance: "CRM should confirm coaching and record a prevention owner.",
      requiresFollowUp: true,
    };
  }
  if (count === 2) {
    return {
      label: "Repeated once",
      guidance:
        "Show stronger problem-specific guidance and verify readiness before the next shift.",
      requiresFollowUp: true,
    };
  }
  return {
    label: "First occurrence",
    guidance: "Show the problem-specific prevention instruction.",
    requiresFollowUp: false,
  };
}

export function resolveAttendanceDiagnostic(input: {
  exception: AttendanceException;
  record?: AttendanceRecord | null;
  scanEvent?: AttendanceScanEvent | null;
}): AttendanceDiagnostic {
  const metadata = input.exception.metadata ?? {};
  const candidates = [
    input.exception.safe_error_code,
    metadataString(metadata, "safeErrorCode"),
    metadataString(metadata, "internalExceptionType"),
    metadataString(metadata, "reasonCode"),
    input.scanEvent?.reason_code,
    input.exception.exception_type,
  ];

  let catalogCode: keyof typeof CATALOG | null = null;
  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (!normalized) continue;
    const alias = CODE_ALIASES[normalized];
    if (alias) {
      catalogCode = alias;
      break;
    }
    if (normalized in CATALOG) {
      catalogCode = normalized as keyof typeof CATALOG;
      break;
    }
  }

  catalogCode ??= messageCode(input.exception.message);

  if (!catalogCode && input.record) {
    if (input.record.clock_out_confirmation_required || input.record.provisional_auto_closed_at) {
      catalogCode = "auto_close_confirmation";
    } else if (input.record.checked_out_at) {
      catalogCode = "clock_out_review";
    } else {
      catalogCode = "clock_in_review";
    }
  }

  if (!catalogCode && (input.scanEvent || input.exception.scan_event_id)) {
    catalogCode = "ambiguous_saved_scan";
  }

  catalogCode ??= "technical_failure";
  return { code: catalogCode, ...CATALOG[catalogCode] };
}

export function resolveAttendanceDiagnosticFromScan(input: {
  reasonCode?: string | null;
  title: string;
  message: string;
  attendanceChanged?: boolean;
}): AttendanceDiagnostic {
  const reason = normalize(input.reasonCode);
  const catalogCode =
    CODE_ALIASES[reason] ??
    (reason in CATALOG ? (reason as keyof typeof CATALOG) : null) ??
    messageCode(`${input.title} ${input.message}`) ??
    (input.attendanceChanged ? "clock_in_review" : "technical_failure");

  const diagnostic = { code: catalogCode, ...CATALOG[catalogCode] };
  return input.attendanceChanged ? { ...diagnostic, attendanceChanged: true } : diagnostic;
}
