# Walk-in booking modal: local comparison

Status: **CORRECTION REQUIRED — browser verification blocked**. This is an uncommitted local UI prototype on `stage/walkin-booking-modal-prototype` at `2f62fff7c3dbb35815947d4ef9a1fd1433de9cfd`, with no database writes, push, merge, or deployment.

`origin/main` resolves locally to `9934d51b6d2dd325b2ef89b1bae70635deb46989`. The stage branch is two local commits ahead: the BKM-001 payment safety fix `efb49f6e` and local merge `2f62fff7`. The accepted remote baseline still contains the Walk-in payment-intent defect. This prototype deliberately preserves the local fix and is not ready for an accepted-main merge without its separate review gate.

The supplied annotated PNG is the visual reference. The numbered callouts and colored borders are annotations, not product UI. The in-app browser refused to acquire the existing tab because of its URL policy. No new screenshot or viewport measurements could be taken; source inspection and jsdom tests cannot establish a visual PASS.

| Section | Reference matched? | Remaining discrepancy or evidence gap |
| --- | --- | --- |
| Header | UNVERIFIED | Logo, title, branch, and one close control are implemented; actual render and spacing unverified. |
| Mode tabs | UNVERIFIED | Three shared modes and source semantics remain; actual visual comparison unverified. |
| Customer | UNVERIFIED | One name autocomplete, phone, notes, and optional expandable email are implemented; actual density unverified. |
| Guests header | UNVERIFIED | Add, Copy, and Clear actions are wired; actual alignment unverified. |
| Guest service selection | UNVERIFIED | Each full-width guest card has independent catalogue search, categories, and two carousel arrows; actual four-card fit unverified. |
| Guest controls | UNVERIFIED | Interactive server-quoted duration buttons, therapist control, shared schedule, room, price, and finish display are rendered for every expanded card; exact visual layout unverified. |
| Guest stacking and scrolling | SOURCE/TEST PASS; VISUAL UNVERIFIED | One column, four expanded cards maximum, vertical overflow on the guest list, no horizontal overflow class, and Add Guest scroll-to-bottom behavior are covered by component tests. Actual pixel overflow and card clipping are unmeasured. |
| Booking summary | UNVERIFIED | Branch, customer, per-guest details, service total, unpaid state, total amount, and actions are rendered; total/payment/actions sit outside the bounded summary detail scroll area. Actual visual fit unverified. |
| Viewport fit | UNVERIFIED | 1920×1080, 1440×900, and 1366×768 could not be measured. Mobile retains an outer-scroll fallback. |

## Contract boundaries

- `createInhouseBookingMultiSchema` in `src/lib/validations/booking.ts` accepts **at most 4 guests** and **at most 5 services per guest**. The earlier five-guest browser state came from a client cap of 10 that exceeded authoritative validation. The modal now caps Add Guest at four. Increasing the server limit requires separate approval.
- Walk-in duration buttons load available options from `/api/booking/service-line-quotes` and refresh the selected quote before changing the line. A compact selected-service control keeps each service line's duration and price independent. Fixed-duration lines retain their fixed value. Price and finish displays remain provisional until Save.
- The current group booking input has one shared start time. Both cards edit that same value, with a shared label. Separate guest starts are not represented as persisted bookings.
- The legacy order-level `staffId` remains a **soft group preference**. Guest 2 shows automatic server assignment. Exact per-guest therapist selection requires accepted `per_guest_exact_v1` and independent server verification.
- A customer-requested therapist selected while the booking has one guest blocks group submission after another guest is added; this prevents silent substitution under the legacy soft-preference contract. The user can return to one guest or select Automatic.
- Group rooms remain server-assigned. The single in-spa booking retains its room choice.
- Default payment remains unpaid. Tender is selected only after an explicit payment-received action; the existing atomic booking/payment action is unchanged.
- Database target is **UNKNOWN**. No transactional booking, payment, or database tests were run.

## Source verification

- Focused Vitest: **7 files, 39 tests passed** on supported Node 24, including four-guest stacking, Add Guest scroll, independent guest durations, independent service-line durations, and the customer-requested group guard.
- Targeted ESLint: passed for all edited booking components and focused tests after the final change. `git diff --check` passed.
- Whole-project TypeScript: fails with **942 errors** across the repository, including unresolved `@testing-library/react` export types in the edited tests. No diagnostics referenced the changed booking UI components in the filtered output. This is not a passing type-check gate.
- Browser comparison, screenshot, viewport overflow, authenticated booking save, and exact therapist/room assignment: **not verified**.

Intended local review URL: `http://localhost:3000/crm/today`. The previously running development server is no longer listening on port 3000. `.env.local` points to a remote Supabase URL whose environment classification is **UNKNOWN**; no new server was launched against it. Classify that target before authenticated runtime review.
