# CRM Performance Baseline

Date: 2026-07-11  
Task: CRM-PERFORMANCE-OPTIMIZATION-001  
Scope: Frozen CRM UI performance audit after the final CRM UI sweep.

## Guardrails

- No CRM UI redesign or visual hierarchy changes.
- No booking lifecycle, dispatch guard, payment, permission, RLS, schema, migration, route, or public API changes.
- No speculative caching for live operational data.
- No broad client/server boundary rewrites while the UI freeze and operator flows are still being certified.

## Documentation Checked

- `AGENTS.md` and root `CLAUDE.md`.
- `docs/AGENT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and `docs/CLAUDE.md`.
- `docs/system-audit/final-crm-ui-freeze-report.md`.
- `docs/system-audit/bookings-reference-certification.md`.
- Next.js 16.2.4 bundled docs for Server/Client Components, lazy loading, fetching data, `fetch`, and `optimizePackageImports`.

## Verification Baseline

Baseline before source edits:

| Command | Result |
| --- | --- |
| `pnpm type-check` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS, Next.js 16.2.4, 108 app routes generated |
| `pnpm test -- --run --testTimeout=10000` | PASS, 83 files / 674 tests |

Post-change verification:

| Command | Result |
| --- | --- |
| `pnpm type-check` | PASS |
| `pnpm lint` | PASS |
| `pnpm test -- --run --testTimeout=10000` | PASS, 83 files / 674 tests |
| `pnpm build` | PASS, Next.js 16.2.4, 108 app routes generated |

## Route Shape

The production build reports all CRM app routes as dynamic server-rendered routes. This is expected because the CRM workspace is authenticated, branch/role scoped, and backed by live operational data.

Examples:

- `/crm`
- `/crm/today`
- `/crm/bookings`
- `/crm/attendance`
- `/crm/dispatch`
- `/crm/schedule`
- `/crm/staff`
- `/crm/setup`

No route was converted to static output during this pass.

## Build Artifact Snapshot

Baseline before edits:

| Area | Files | Bytes |
| --- | ---: | ---: |
| `.next/static` | 178 | 6,289,617 |
| `.next/static/chunks` JS | 147 | 5,422,726 |
| `.next/static/chunks` CSS | 5 | 373,007 |

After edits and final build:

| Area | Files | Bytes |
| --- | ---: | ---: |
| `.next/static` | 178 | 6,289,893 |
| `.next/static/chunks` JS | 147 | 5,423,002 |
| `.next/static/chunks` CSS | 5 | 373,007 |

The post-change JS artifact total is 276 bytes larger because of added React hook imports. The optimization value is runtime render/effect work reduction, not bundle shrink.

Largest final static chunks:

| Chunk | Bytes |
| --- | ---: |
| `.next/static/chunks/0vbmta3f_56kv.css` | 305,640 |
| `.next/static/chunks/06j7mq4_s-ba4.js` | 270,072 |
| `.next/static/chunks/0swt-5iq-5qfk.js` | 242,060 |
| `.next/static/chunks/0vr9akpvds0cj.js` | 232,682 |
| `.next/static/chunks/08owt2bx7nsw2.js` | 155,672 |
| `.next/static/chunks/10iflemh5uqio.js` | 151,605 |
| `.next/static/chunks/0u738~2s-y1tb.js` | 120,732 |
| `.next/static/chunks/03~yq9q893hmn.js` | 112,594 |
| `.next/static/chunks/0ac-~qs2_vqcr.js` | 109,246 |
| `.next/static/chunks/16k5by-v3s9my.js` | 95,804 |

## CRM Client Reference Manifest Hotspots

The route-level client reference manifests remain broadly similar after the source edits:

| Route manifest | Feature references | Bytes |
| --- | ---: | ---: |
| `/crm/setup` | 40 | 69,402 |
| `/crm/staff-availability` | 38 | 70,303 |
| `/crm/availability` | 30 | 69,397 |
| `/crm/staff` | 30 | 63,184 |
| `/crm/dispatch` | 28 | 63,156 |
| `/crm/attendance` | 26 | 62,434 |
| `/crm/bookings` | 26 | 62,493 |
| `/crm/today` | 26 | 62,497 |
| `/crm/customers` | 26 | 62,997 |
| `/crm/schedule` | 26 | 62,531 |

Interpretation: the immediate performance work should target render/effect stability inside existing client workspaces before broad bundle splitting. Broad splitting could easily disturb frozen modal/tab state.

## Source Hotspots

Largest scoped CRM-adjacent source files from the audit:

| File | Lines |
| --- | ---: |
| `src/components/features/bookings/bookings-table.tsx` | 1,836 |
| `src/app/(dashboard)/crm/bookings/actions.ts` | 1,334 |
| `src/components/features/bookings/quick-booking-form.tsx` | 1,331 |
| `src/components/features/dispatch/home-service-dispatch-modal.tsx` | 760 |
| `src/components/features/attendance/records/attendance-records-tab.tsx` | 643 |
| `src/components/features/crm/services/crm-therapist-assignment-tab.tsx` | 643 |
| `src/components/features/crm/today/work-queue-panel.tsx` | 625 |
| `src/components/features/crm/availability/crm-availability-client.tsx` | 622 |
| `src/components/features/dispatch/dispatch-live-map-tab.tsx` | 545 |
| `src/components/features/bookings/bookings-workspace.tsx` | 509 |

## Audit Findings

- Today Work Queue derived next actions in both the dashboard summary and the panel. The panel already memoized row actions, but the dashboard summary recomputed its own derived action list on every local render.
- Today Work Queue filter counts used multiple array filters, and visible rows were recalculated outside memoization.
- Bookings Workspace recalculated workflow tab counts with repeated scans over `bookings`, recalculated visible rows on unrelated local state changes, and derived the initial selected booking tab on every render even though only the initial state uses it.
- Dispatch Live Map passed an inline `onSelect` callback into `MapCanvas`. Because the map effect depends on `onSelect`, selecting a booking could tear down and recreate markers/map work even when the filtered booking list was unchanged.
- Attendance realtime uses one branch-scoped Supabase channel and a 500 ms debounced `router.refresh()`. This was left unchanged because it protects live operational correctness.
- Broad query narrowing and index work was not performed because it would require schema/API/DTO validation outside the frozen UI performance scope.

## Deferred Areas

- Do not dynamically split Bookings table/modal flows until Bookings gets authenticated browser certification. The existing certification record says Bookings should remain NOT CERTIFIED because the blocker is browser interaction/auth environment, not automated checks.
- Do not add bundle analyzer dependencies during the freeze. The audit used Turbopack build artifacts and source scans.
- Do not alter Supabase schema, RLS, indexes, or migrations.
- Do not change live route caching or revalidation semantics for CRM operational pages.
