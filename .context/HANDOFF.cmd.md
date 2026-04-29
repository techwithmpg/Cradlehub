# 🤝 HANDOFF

| Field | Value |
|-------|-------|
| **Agent** | Codex/Kimi (Sprint 1) |
| **Build Status** | ✅ Passing |
| **Mood** | Engine is complete |

## What I Did
Built the entire server engine for CradleHub. All 10 business rules are encoded.
Zero UI — pure server logic only.

## What Is Next
**Sprint 2 — Authentication + Dashboard Shell:**
1. `src/app/(auth)/login/page.tsx` — email/password login form
2. `src/app/(dashboard)/layout.tsx` — shared sidebar + header for all workspaces
3. Role-aware sidebar nav links (owner/manager/crm/staff show different items)
4. User profile dropdown in header (name, role badge, logout)

## Critical Things to Know
- ALL bookings are auto-confirmed (status='confirmed'). No pending state.
- "Any therapist" uses seniority assignment — see `src/lib/engine/availability.ts`
- Price snapshot goes into booking metadata on every INSERT — see `src/lib/engine/snapshot.ts`
- `set_config('app.current_staff_id', ...)` must be called before status changes so
  the trigger can write changed_by to booking_events
- Admin client (admin.ts) is used for: public booking creation, staff invite.
  Never import admin client in anything under 'use client'
- `editBookingAction` re-checks availability AND re-snapshots metadata when
  service changes — this is intentional
