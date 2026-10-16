# CRM/CSR Gremlin Day — 2026-10-02

## Executive verdict

**IN PROGRESS — CORRECTION REQUIRED.** This is an authenticated hosted Main Spa operational pass with read-only checks against the positively identified production database. One QA customer and two QA orders (three service lines) were created through the app; all three service lines were then canceled through supported app actions. No payment or other financial mutation was submitted. The opening pass found a three-day-old open cash session and three failed readiness checks; financial tests are held until session behavior is understood.

## Environment and authority

| Item | Value |
| --- | --- |
| Repository | `techwithmpg/Cradlehub` |
| Working branch | `test/crm-csr-gremlin-day` (isolated worktree) |
| Base / initial head / origin/main | `ace46f6d82dc277363c4efeff992f1f739103547` |
| Application | `https://www.cradlewellnessliving.com` — hosted production |
| Database target | **PRODUCTION**, Supabase project `lsrbwqhvzjfpiabeolkv`, `db.lsrbwqhvzjfpiabeolkv.supabase.co` |
| Auth persona | Signed-in Front Desk workspace user; identity visible in application, omitted here to avoid unnecessary staff data duplication |
| Selected branch | Cradle Wellness living Main Spa, ID `c1000000-0000-0000-0000-000000000001`; owner confirmed Main Spa for QA |
| QA marker | `[QA-GREMLIN-20261002]` |

Latest owner instruction authorizes normal authenticated application QA workflows and read-only live SQL. It does not authorize direct live SQL mutations, migrations, merge, or deployment. Any live record created during this pass must be added to the ledger below.

## Full-day timeline

| Manila time | Action | Status | Evidence |
| --- | --- | --- | --- |
| 09:48–09:53 | Sign in, select Front Desk, inspect Cradle Flow, Bookings, Schedule, Attendance, Home Service, Cash Flow | VERIFIED for navigation and visible opening state | Hosted browser pages on 2026-10-02 |
| 09:46 | Public multi-guest draft: select distinct services, remove Guest 2, add another guest, navigate forward/back | FAILED for unique guest labels; booking unsubmitted | Hosted public booking wizard |
| 09:53–09:58 | Prepare one marked Main Spa booking; move it from Walk-in Now to future date to avoid an immediate staff/room hold; submit | VERIFIED | Hosted CRM, live customer/order/booking rows |
| 09:58–10:03 | Navigate to Customers and Bookings, reschedule 10:00 → 11:30, reassign therapist, compare Schedule, cancel | VERIFIED | Hosted modules + live booking row; canceled slot returned in availability lookup |
| 10:05–10:08 | Reuse same QA customer, submit two-service order with double click, verify one order/two lines, cancel each line | VERIFIED | Hosted CRM + live order/booking rows |
| Later scenarios | Booking persistence, customer history, assignment, payment, expense, dispatch, branch switch, handover, day close | NOT VERIFIED or BLOCKED as documented below | — |

## Gremlin log

| ID | Time / scenario | Module | User action | Expected | Actual | Reproducible? | Severity | Evidence | Root cause | Fixed? | Retest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GRM-001 | 09:46 multi-guest | Public booking | Add Guest 3, remove Guest 2, add another | Distinguishable guest labels | Two distinct attendees both displayed as `Guest 3`, each retained its own service | Yes, one hosted reproduction | P2 | HOSTED APPLICATION VERIFIED, draft only | `handleAddAttendee` uses `prev.length + 1` after removal; existing names are not renumbered | No, outside P0/P1 fix policy | Not retested |
| GRM-002 | 09:48 opening readiness | Cradle Flow | Load Main Spa today | Actionable readiness snapshot | Three warnings: operational readiness, daily operations, setup readiness could not be checked; affected warnings may not appear | Yes on repeated page load | P1 provisional | HOSTED APPLICATION VERIFIED | Not isolated | No | Not retested |
| GRM-003 | 09:52 cash opening | Cash Flow | Inspect Main Spa drawer | Current-day session state clear | UI says drawer open, ₱500 float, ₱2,700 expected cash, but omits business date; live open session belongs to 2026-09-29 | Yes on opening pass | P1 for lifecycle blocker; P2 for hidden date | HOSTED APPLICATION + LIVE DATABASE VERIFIED for displayed state and session row | Open session persists; live close RPC absent as of inspection | No, another workstream may own cash close | Not retested |
| GRM-004 | 10:06 existing-customer booking | Customers preview | Create new booking from QA customer's preview | Preview reflects new upcoming booking after successful save | Underlying preview still showed `NEXT BOOKING —` and only the previously canceled activity until browser refresh | Yes on this hosted pass | P2 | HOSTED APPLICATION VERIFIED; live booking already existed | Preview data was not refreshed after its own booking modal succeeded; exact state invalidation path not isolated | No | Refresh showed current state |
| GRM-005 | 10:03 cancellation | Booking follow-up | Open Cancel Booking on a future scheduled QA booking | Accurate branch and source in confirmation | Modal showed `BRANCH Branch` and `SOURCE Walk-in` although the booking was Main Spa `standard_future` | Yes on three QA lines | P2 | HOSTED APPLICATION VERIFIED; live booking metadata confirmed future mode | UI display mapping not isolated | No | Not retested |

## Live QA record ledger

| Domain | Record ID | Branch | Purpose | Created through | Created by | Created at (UTC) | Expected side effects | Cleanup status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer | `1fdeecf6-b7cb-4b42-bf86-d461b68b32b5` | Main Spa booking context; customers are global | Dedicated marked QA identity; owner supplied QA contact | CRM New Booking | Signed-in Front Desk user | 2026-10-02 01:58:23 | Customer profile and history | Retained, clearly QA; no supported safe delete used |
| Booking order | `f4d05492-f217-47e2-b500-cd0d1574eaa2` | Main Spa | Initial future scheduled QA booking | CRM New Booking | Signed-in Front Desk user | ~2026-10-02 01:58 | One ₱500 service line, therapist/room hold, no payment | Service line canceled through CRM |
| Booking line | `541b4fa4-d2e3-433d-b5cf-c02ac406e219` | Main Spa | Creation, reschedule, reassignment, cancellation | CRM Bookings | Signed-in Front Desk user | ~2026-10-02 01:58 | Hold one future therapist/room slot; ₱0 financial movement | `cancelled` 02:02:58 UTC; canceled slot available in app lookup |
| Booking order | `4c06ef80-95db-4904-9579-67fe84e2c493` | Main Spa | Existing-customer, two-service, double-submit test | Customers → New Booking | Signed-in Front Desk user | 2026-10-02 02:06:31 | Two sequential service lines totaling ₱1,050; no payment | Both lines canceled through CRM |
| Booking line | `1b238a0a-b8f0-4435-b3fd-71428e5a4394` | Main Spa | Aromatherapy ₱550, 13:00–14:10 | Customers → New Booking | Signed-in Front Desk user | ~2026-10-02 02:06 | Future therapist/room hold; ₱0 financial movement | `cancelled` 02:07:45 UTC |
| Booking line | `c6c3e690-57f9-4716-8909-613459341311` | Main Spa | Cradle Swedish Massage ₱500, 14:10–15:20 | Customers → New Booking | Signed-in Front Desk user | ~2026-10-02 02:06 | Future therapist/room hold; ₱0 financial movement | `cancelled` 02:08:10 UTC |

The ledger's actor is corroborated by the signed-in UI. This pass did not query the auth-user ID or an authoritative booking actor field. The customer contact is intentionally omitted from this report; it was supplied by the owner and does not match a preexisting live customer.

## P0 findings

None confirmed.

## P1 findings

- **Opening readiness checks failed** in Cradle Flow. Impact: staff check-in, dispatch, payment, ghost check-in, opening-shift, follow-up, and setup issues may not appear. This is a visible operational warning; root cause not yet isolated.
- **Cash session lifecycle is blocked.** The Main Spa drawer has an open session `ae55af90-d88f-41fd-bd61-792f87e7cd76` with business date 2026-09-29, opening float ₱500, and cash account `a2bdce9c-6f9c-413e-afd3-41916be145c4`. Live database has no Main Spa cash session dated 2026-10-02. Live catalog inspection found `open_cash_session_atomic` but no cash close/handover function. Current drawer balance is not a fresh daily session. No further cash mutation has been attempted.

## P2 findings

- GRM-001 duplicate guest labels after remove/add, with independent service selections preserved in the draft.
- Cash Flow does not show the date of its currently open 2026-09-29 session in the opening summary; a CSR could mistake it for today's drawer.
- GRM-004: Customer preview remains stale after its own successful new booking until refresh.
- GRM-005: Booking cancellation confirmation gives a generic branch and labels future bookings as Walk-in.

## P3 findings

None confirmed.

## Booking results

Bookings loaded for Main Spa on 2026-10-02: 0. The first submitted QA booking was moved from Walk-in Now to Future Scheduled (2026-10-16) before saving to avoid occupying a real-time staff/room slot. HOSTED APPLICATION + LIVE DATABASE VERIFIED: one Main Spa order, one ₱500 Cradle Swedish line, 10:00–11:10 initially, assigned therapist and room, ₱0 paid. Reschedule to 11:30–12:40 and reassignment both persisted and appeared in Bookings and Schedule. Supported cancellation changed the row to `cancelled`; a fresh app availability lookup again offered the 11:30 slot for the same therapist/service. The second order reused the customer and persisted Aromatherapy 13:00–14:10 ₱550 plus Cradle Swedish Massage 14:10–15:20 ₱500, both Main Spa, then both were canceled. Public multi-guest draft retained the three attendees' distinct services and ₱1,550 aggregate total before navigating back; date/time selection reset on return to Services and was not classified as a defect without the product contract. A genuine Walk-in Now save remains NOT VERIFIED because it would immediately assign a real on-duty therapist and room.

## Customer results

Read-only live SQL found no customer whose name contains `QA Gremlin` and no record matching the owner-provided QA phone before this pass. One QA customer was created by the booking workflow. Hosted Customers search found that same profile; its preview showed the booking's date, service, status, and price. After cancellation and refresh, recent activity retained the canceled booking and Next Booking cleared. The second order reused the same customer; live count remained one QA customer.

## Schedule results

Main Spa Daily Timeline loaded for 2026-10-02: 56 staff in view, 39 scheduled, 5 shown as available now in Today's Summary, 0 busy, 17 off. Individual schedule rows loaded. The separate lower `Available Now` section showed 39; the meaning of that count needs clarification before classification. On 2026-10-16, the QA appointment appeared under its assigned therapist after reassignment. After cancellation, Schedule still displayed the booking as a historical timeline block explicitly marked `Cancelled`; a fresh availability lookup offered the released 11:30 slot, so this was not classified as an active resource hold.

## Attendance results

Main Spa Today loaded: 0 working, 39 not in yet, 0 needs review in the Today summary, 0 checked out. No attendance mutation performed. Review tab displayed `1 open`; relationship to the Today count is not yet established.

## Home Service results

Main Spa Live Operations loaded with 0 scheduled, awaiting travel, en route, arrived, in service, completed, and alerts. No dispatch performed.

## Payment results

NOT VERIFIED. No payment submitted.

## Expense results

NOT VERIFIED. No expense submitted.

## Cash operations results

NOT VERIFIED. No cash operation submitted.

## Drawer/session results

HOSTED APPLICATION + LIVE DATABASE VERIFIED for the opening state: the UI displays open drawer, ₱500 opening float, ₱2,700 expected cash. Read-only SQL found the open Main Spa session above dated 2026-09-29; the linked account is active, Main Spa scoped, and has five movements since the session opened, net +₱2,200. This reconciles arithmetically to ₱2,700. It does not prove a physical count or daily reconciliation.

## Handover results

BLOCKED BY KNOWN P1. No live cash close/handover RPC was found. No custody mutation attempted.

## Day close results

BLOCKED BY KNOWN P1. No live close RPC was found. No close attempted.

## Owner branch results

NOT VERIFIED. No branch switch yet.

## Role/authorization results

The signed-in session entered the Front Desk workspace. Server action source checks authenticated user, active staff row, CRM role, and branch equality for non-owner staff. Runtime forbidden-action behavior was not tested.

## Double-submission results

NOT VERIFIED. No live mutation double-submitted.

## Two-tab results

HOSTED APPLICATION VERIFIED: Schedule in a separate tab remained stale immediately after booking cancellation. After refresh it showed the same historical block with explicit `Cancelled` status; the slot was available to book. Customers preview stayed stale after booking creation from its own modal until browser refresh (GRM-004).

## Back/refresh results

HOSTED APPLICATION VERIFIED for unsubmitted public booking draft navigation: Details → Date & Time → Services retained attendee service selections; slot selection was cleared on return to Services. CRM booking and customer states were reloaded after creation/cancellation and remained persisted. Browser-back after a CRM save remains NOT VERIFIED.

## Network failure results

NOT VERIFIED.

## Database consistency results

LIVE DATABASE VERIFIED for production project identity, relevant table/function presence, two active branch IDs, absence of today's Main Spa cash session, and the older open session/account movements. For QA bookings: one customer, two orders, three booking lines; all three lines now `cancelled`, all `amount_paid=0`. The first order branch, customer, service, therapist, room, date/time, and status matched the hosted UI. The second order had precisely two sequential service lines totaling ₱1,050 with the same customer and Main Spa branch. A read-only query found no financial transaction sourced from these three booking IDs or either order ID.

## Console/network errors

Browser console error/warn inspection on Schedule and Attendance returned no entries. Network status and individual requests were not captured; Cradle Flow's three readiness warnings are visible application-level failures.

## Performance observations

Schedule and Attendance briefly displayed blank/skeleton states before content loaded; no reliable duration or bottleneck captured. No performance defect classified.

## Fixes made

None. The two QA order creations and three cancellations were application workflow mutations, not code fixes.

## Files changed

This audit report only, pending completion.

## Exact test commands and automated test results

No automated test command run for this pass yet. Read-only SQL queries and hosted UI interactions are described above; they are not automated test results.

## Browser evidence

HOSTED APPLICATION VERIFIED: authenticated Main Spa navigation and opening states; public multi-guest draft reproduction; CRM booking creation, retrieval after navigation, reschedule, reassignment, schedule visibility, cancellation, customer history, multi-service booking, and double-click submission.

## Database evidence

LIVE DATABASE VERIFIED: Supabase project `lsrbwqhvzjfpiabeolkv` and the specific read-only findings recorded above. Hosted application writes were checked with live read-only SQL. No database write performed through SQL.

## Physical device evidence

NOT VERIFIED.

## Production evidence

HOSTED APPLICATION + LIVE DATABASE VERIFIED for the specific QA booking creation, reschedule, reassignment, multi-service order, cancellation, and final record counts stated here. No payment, expense, cash operation, Home Service dispatch, or day close result is production verified.

## Not verified

Genuine Walk-in Now booking, public booking submission, customer lookup by partial name/phone, payment, expense, cash operation, home-service dispatch, schedule collision rejection, cancellation after payment, no-show, role boundary, branch switch, offline retry, handover, reconciliation, day close, tomorrow.

## Remaining operational blockers

1. Cash session from 2026-09-29 remains open; no live close/handover RPC observed.
2. Cradle Flow readiness checks all fail visibly.
3. Financial workflow mutation remains held because the open Main Spa session predates the test day and the live close/handover path is absent. Browser-control policy also requires user handoff for the final consequential financial transaction action.

## Rollback considerations

One marked QA customer and two order records remain for audit history. Their three booking lines were canceled via supported CRM actions, with no payment. Live SQL did not alter anything. Later QA financial history, if any, must remain intact unless a supported domain reversal is used. No migration, merge, or deployment is authorized by this pass.

## Final recommendation

**CORRECTION REQUIRED (provisional).** Continue unaffected safe workflows and independent review of the P1 blockers. Do not merge or deploy from this report.
