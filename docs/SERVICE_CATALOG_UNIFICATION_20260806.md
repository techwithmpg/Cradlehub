# Unified Service Catalogue Repair Report - 2026-08-06

## 1. Root Cause

The SM limitation was caused by a combination of seed/catalogue drift and duplicate service-loading/validation paths.

- `supabase/migrations/20260511000001_real_cradle_service_catalog.sql` inserted the real global catalogue into `services` without creating matching `branch_services` overlays.
- `src/app/(dashboard)/owner/services/actions.ts` previously created only the global `services` row, allowing active services such as `Massage Services / Ram` to exist without branch mappings.
- SM had only 8 active in-spa branch rows while Main had 137 active in-spa branch rows.
- CRM staff assignment used active SM `branch_services`, so missing SM overlay rows directly removed services from staff capability pickers.
- RLS, duplicate branch rows, invalid `staff_services`, and SM Home Service flags were not primary causes.

## 2. Counts

| Metric | Before | After |
| --- | ---: | ---: |
| Global active services | 138 | 138 |
| Main active services | 137 | 137 |
| Main active in-spa services | 137 | 137 |
| Main active Home Service services | 85 | 85 |
| SM active services | 8 | 137 |
| SM active in-spa services | 8 | 137 |
| SM active Home Service services | 0 | 0 |
| Main in-spa services missing at SM | 129 | 0 |
| Invalid `staff_services` mappings | 0 | 0 |
| Duplicate `branch_services` mappings | 0 | 0 |
| Visibility drift rows | 0 | 0 |

Main branch: `c1000000-0000-0000-0000-000000000001`
SM branch: `c1000000-0000-0000-0000-000000000002`

## 3. Exact Services Restored To SM

These 129 services were restored to SM and therefore restored to the SM staff assignment picker. They also remain readiness warnings until qualified SM staff are manually assigned.

### Divine Renewal Packages

Celestial Glow Package; Divine Renewal Package; Halo Glow Mini; Halo Massage Escape; Heavenly Harmony Couples or Besties Spa; Seraphic Beauty Ritual; Serenity Detox Package; Serenity Soles; Tranquil Touch Package; Weekday Wind Down.

### Massage Services

Angels Massage; Aromatherapy; Balinese Massage; Combination Massage; Cradle Swedish Massage; Eco Sculpt Massage; Filipino Hilot; Hawaiian Lomi Lomi Massage; Head & Foot Massage; Herbal Ball; Himalayan Hot Stone Massage; Mandara Massage; Moxa Ventosa; Moxa Ventosa w/ Pinoy Ginhawa; Post Natal Massage; Pre Natal Massage; Shiatsu; Sports Massage; Thai Massage; Volcanic Hot Stone Massage.

### Salon Services

Balayage; Blowdry Only; Blowdry with Style; Ear Candling; Eye Make Up; Eyebrow Threading; Eyelash Extensions Cat Eye; Eyelash Extensions Cradle Signature Lash; Eyelash Extensions Mardi Gras Look; Eyelash Extensions Natural Look; Eyelash Extensions Open Eye; Eyelash Perm; Foot Scrub; Foot Spa; Full Hair & Make Up; Gel Manicure ORLY; Gel Pedicure ORLY; Gel Polish Removal Hands/Feet; Hair Color Labor; Hair Color Long Hair; Hair Color Medium Hair; Hair Color Rootings / Short Hair; Hair Cut; Hair Cut with Shampoo; Hair Iron; Hair Nourishing / Concentrating Vial Treatment; Hair Rebond; Hair Scrub Shampoo; Hair Spa Long Hair; Hair Spa Medium Hair; Hair Spa Short Hair; Hair Style; Hair Style without Makeup; Hair Treatment Labor; Highlights; Kerabond; Keratin Treatment Long Hair; Keratin Treatment Medium Hair; Keratin Treatment Short Hair; Make Up Home Service; Mani-Pedi w/ Foot Scrub Package; Mani-Pedi w/ Foot Spell Spa Package; Manicure & Pedicure; Metal Detox Package; Metal Detox Treatment Only; Ombre; Power Dose / Power Mix Long Hair; Power Dose / Power Mix Medium Hair; Power Dose / Power Mix Short Hair; Shampoo Only; Shampoo with Blowdry; Waxing Bikini; Waxing Facial / Eyebrows / Beard / Nape; Waxing Hollywood / Brazilian; Waxing Legs Calf; Waxing Thighs; Waxing Underarm.

### Skin Care Services

Aqua Facial; Bio Skin Lift Anti-Aging Treatment; Bio Skin Lift with PDT Light; Carbon Laser Treatment Face Area; Carbon Laser Treatment Face Area with PDT Package; Carbon Laser Treatment Underarm Area; Cradle Celebrity Facial Package; Diode Laser Arm; Diode Laser Beard; Diode Laser Bikini; Diode Laser Brazilian; Diode Laser Chest; Diode Laser Legs; Diode Laser Mustache; Diode Laser Underarm; Diode Laser Upper / Lower Lip; Diode Laser Whole Body; Diode Laser Whole Face; Facial Cleansing with Mask; Filipino Coffee Body Scrub; Hydra Dermabrasion + Oxy Jet; Hydra Dermabrasion + Oxy Jet with PDT Light; Hydra Facial; Hydra Facial with PDT Package; Korean Glass Skin Facial; Lemon Body Scrub; Lux Body Scrub; Medium Size Tattoo Removal; Organic Facial Cleansing with Mask; Oxy Jet Peel Facial; Oxy Jet Peel Facial with PDT Light; PDT Light; Pico + Whitening Underarm Package; Pico Tattoo 2 in 1 Bikini; Pico Tattoo 2 in 1 Face; Pico Tattoo 2 in 1 Legs; Pico Tattoo 2 in 1 Others; Pico Tattoo 2 in 1 Underarm; Tattoo Removal Below 3x3 or 2x4 inches.

### Spa Party Packages

Alexandrite Package; Aquamarine Package; Peridot Package.

## 4. Home Service And Naming Audit

- Exact Main Home-only services excluded from SM: none. Live query count: 0.
- Exact SM Home Service violations corrected: none existed before apply; migration still forced `available_home_service = false` on all SM rows and `branch_booking_rules.home_service_enabled = false`.
- `Make Up Home Service` is a name-only oddity in the restored in-spa catalogue. Stored SM flags are `available_in_spa = true` and `available_home_service = false`.

## 5. Staff Capability And Readiness

- Exact services restored to the SM staff assignment picker: the 129 services listed above.
- SM services still missing qualified staff: the same 129 restored services listed above.
- Existing invalid historical staff capability mappings found: 0.
- Services with provider assignments only at another branch: reflected by the 129 restored SM readiness warnings; Main assignments were not copied.
- Services visible in owner but rejected by CRM: repaired by using target-staff-branch assignability in all role paths.
- Services shown by the UI but rejected by RPC: rollback-only live checks verified a canonical SM service is accepted and the unavailable `Ram` service is rejected.

## 6. Migration

Created and applied:

`supabase/migrations/20260806132402_service_catalog_unification_repair.sql`

The migration:

- Creates `public.branch_service_booking_visibility_from_visibility(text)`.
- Creates `public.is_branch_service_assignable(uuid, uuid)`.
- Updates operational `staff_services` policies to use the same assignability helper.
- Replaces `public.replace_staff_service_capabilities(uuid, uuid[])`.
- Creates `public.ensure_branch_service_rows_for_new_service()` and the `ensure_branch_service_rows_after_service_insert` trigger.
- Disables SM Home Service at branch rules and service-row levels.
- Inserts missing SM `branch_services` rows from Main active in-spa services with `custom_price = NULL`, `custom_duration_minutes = NULL`, active/in-spa true, Home Service false, and safe presentation fields.

Because live migration history is drifted, the SQL was applied with `supabase db query --file`, not `db:push`. The live effects are present, but version `20260806132402` is not recorded in `supabase_migrations.schema_migrations`.

## 7. Canonical Modules

- `src/lib/services/service-types.ts`
- `src/lib/services/service-eligibility.ts`
- `src/lib/services/service-catalog.ts`

Exposed resolver family:

- `getMasterServiceCatalog`
- `getBranchServiceCatalog`
- `getBranchServiceCatalogCached`
- `getBranchAssignableServices`
- `getAssignableServicesForStaff`
- `validateBranchServiceEligibility`
- `getBranchProviderReadiness`
- `branchServicesToServiceProfileRows`
- `synchronizeBranchServiceCatalog`

## 8. Query Paths Redirected Or Kept As Delegating Wrappers

- `src/lib/queries/branches.ts`: legacy branch-service exports now delegate to the canonical resolver.
- `src/lib/queries/services.ts`: global reads use the canonical master resolver; public catalogue normalizes visibility through canonical helpers.
- `src/lib/queries/quick-booking-options.ts`: Quick Booking uses canonical CRM branch catalogue.
- `src/app/api/public/booking-context/route.ts`: public context uses canonical public branch catalogue.
- `src/app/api/public/waitlist/route.ts`: waitlist validates with canonical public eligibility.
- `src/lib/actions/online-booking.ts`: online booking validates with canonical public delivery eligibility and explicit staff capability requirement.
- `src/lib/actions/inhouse-booking.ts`: in-house booking validates with canonical CRM delivery eligibility.
- `src/lib/engine/availability.ts`: availability prevalidates canonical branch/delivery eligibility before schedule/provider filtering.
- `src/app/api/booking/available-slots/route.ts` and `src/app/api/booking/crm-availability/route.ts`: availability APIs validate with canonical delivery mode.
- Owner, manager, CRM, and onboarding staff capability screens now use target-branch assignable services.

## 9. Staff Assignment Paths Unified

- CRM: `src/lib/actions/crm-staff-services.ts`
- Owner/manager staff edit: `src/app/(dashboard)/owner/staff/actions.ts`
- Staff onboarding approval: `src/app/staff-onboarding/actions.ts`
- Owner staff new: per-branch assignable services via `servicesByBranch`
- Owner staff detail and manager staff detail: `getAssignableServicesForStaff`
- CRM staff/setup/schedule: `getBranchAssignableServices`

## 10. Capability RPC Changes

The RPC now:

- Resolves the target staff member branch.
- Validates global service active state.
- Validates active target-branch mapping.
- Requires at least one enabled branch delivery mode.
- Allows internal services for operational assignment.
- Rejects Main-only/unavailable services for SM staff.
- Validates all requested IDs before deleting existing assignments.
- Preserves prior assignments when validation fails.
- Returns final saved service IDs.
- Keeps non-owner actors branch-scoped and blocks privileged target edits.
- Allows trusted server-side `service_role` usage for onboarding while keeping anon/public revoked.

## 11. Visibility Decision

`branch_services.visibility` is authoritative for runtime behavior. `booking_visibility` remains a legacy compatibility column and is written in sync. No column was dropped; cleanup is deferred until all readers/writers and data drift are fully audited.

## 12. Cache And Invalidation

Updated cache coverage includes:

- Branch service tags.
- Branch assignable-service tags.
- CRM workspace/setup/readiness/availability tags.
- Manager workspace tags.
- Public `/`, `/services`, `/book`, and booking context paths.
- Owner branch/services/staff paths.
- Capability mutation paths.
- Branch booking-rule mutations, including Home Service disabled cleanup.

## 13. Verification Results

- Focused service tests: 2 files / 10 tests passed.
- Full tests: 197 files / 1350 tests passed.
- `pnpm type-check`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `pnpm db:verify-live`: passed on retry, with known migration parity warning.
- Live database repair: verified.
- SM in-spa catalogue synchronization: verified, 137 active in-spa.
- SM Home Service exclusion: verified, 0 SM Home Service rows and branch rule disabled.
- Public booking: local API/browser smoke verified.
- Quick Booking, owner/manager/CRM authenticated UI: code paths and automated gates verified; browser sessions were unavailable because protected routes redirect to `/login`.
- Capability RPC validation: live rollback-only accepted valid SM service and rejected unavailable SM service with SQLSTATE 22023.
- Provider readiness: verified, 129 SM services need staff assignment.
- Availability/staff recommendations: source now uses canonical eligibility before staff/schedule filtering; tests/build pass.

## 14. Files Changed By This Task

Primary new files:

- `src/lib/services/service-types.ts`
- `src/lib/services/service-eligibility.ts`
- `src/lib/services/service-catalog.ts`
- `supabase/migrations/20260806132402_service_catalog_unification_repair.sql`
- `tests/lib/services/service-eligibility.test.ts`
- `tests/lib/services/service-catalog-migration.test.ts`
- `docs/SERVICE_CATALOG_UNIFICATION_20260806.md`

Primary modified service-catalogue files:

- `src/app/(dashboard)/owner/services/actions.ts`
- `src/app/(dashboard)/owner/branches/actions.ts`
- `src/app/(dashboard)/owner/branches/[branchId]/page.tsx`
- `src/app/(dashboard)/owner/staff/actions.ts`
- `src/app/(dashboard)/owner/staff/[staffId]/page.tsx`
- `src/app/(dashboard)/owner/staff/new/page.tsx`
- `src/app/(dashboard)/owner/staff/new/staff-invite-form.tsx`
- `src/app/(dashboard)/manager/services/page.tsx`
- `src/app/(dashboard)/manager/settings/page.tsx`
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx`
- `src/app/(dashboard)/crm/services/actions.ts`
- `src/app/(dashboard)/crm/setup/page.tsx`
- `src/app/(dashboard)/crm/staff/page.tsx`
- `src/app/(dashboard)/crm/schedule/actions.ts`
- `src/app/api/public/booking-context/route.ts`
- `src/app/api/public/waitlist/route.ts`
- `src/app/api/booking/available-slots/route.ts`
- `src/app/api/booking/crm-availability/route.ts`
- `src/app/api/manager/context/route.ts`
- `src/lib/actions/online-booking.ts`
- `src/lib/actions/inhouse-booking.ts`
- `src/lib/actions/crm-staff-services.ts`
- `src/lib/engine/availability.ts`
- `src/lib/queries/branches.ts`
- `src/lib/queries/services.ts`
- `src/lib/queries/quick-booking-options.ts`
- `src/lib/queries/crm-setup.ts`
- `src/lib/queries/branch-booking-rules.ts`
- `src/lib/cache/cache-tags.ts`

Governance/docs updated:

- `.context/CHANGELOG.cmd.md`
- `.context/CURRENT_TASK.cmd.md`
- `.context/DECISIONS.cmd.md`
- `.context/ERRORS.cmd.md`
- `.context/HANDOFF.cmd.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/ROADMAP.md`

Pre-existing dirty onboarding files were preserved and not reverted. Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the maintained equivalents are under `docs/` plus `AGENTS.md`.

## 15. Unresolved Risks And Manual Work

- Manual SM staff capability assignment is still required for the 129 restored services.
- Authenticated owner, manager, CRM, setup, staff assignment, and Quick Booking browser QA still needs a safe signed-in session.
- Migration history remains drifted. Do not run broad `db:push` until local/remote migration history is reconciled.
- The live active global service `Massage Services / Ram` still has no branch mapping because it is not part of Main active in-spa. It remains evidence of prior service-creation drift; future inserts are now protected.
