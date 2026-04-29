## What Is Next — Sprint 7: Online Booking Flow (customer-facing)

4-step public booking flow:
1. /book → select branch
2. /book/[branchId] → select service
3. /book/[branchId]/[serviceId] → pick therapist + time slot
4. /book/confirm → enter name/phone/notes → submit → confirmation screen

Key details for Sprint 7:
- Uses createOnlineBookingAction from (public)/book/actions.ts
- Calls /api/booking/available-slots for slot grid
- "Any therapist" option auto-assigns by seniority (engine handles this)
- Home service toggle adds travel buffer
- No auth required — fully public
- Booking confirmed immediately (no pending state)

After Sprint 7: Sprint 8 is the public website
(Homepage, Services, Branches, About, Contact, navbar, footer)
