Task ID: SCHEDULE-RULE-BUILDER-UI-001
Description: Redesign Schedule Setup General Rules and Individual Schedule Editing UI
Agent: Codex
Status: DONE

Summary:
- Redesigned the Schedule Setup General Rules tab into a role-aware shift rule builder with group tabs, shift definition cards, weekly pill toggles, coverage summary, group summary, and quick actions.
- Added schedule policy utilities so opening/closing roles and regular-only roles render the correct shift controls without changing backend rule storage.
- Redesigned Individual Adjustments into a staff weekly editor with staff selector, profile context, save/reset actions, custom override indicators, compare-with-group snapshot, right rail, and schedule summary.
- Preserved the existing group rule actions and individual weekly schedule action; no booking, dispatch, driver, staff portal, payment, schema, or unrelated backend logic was changed.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are not present in this workspace.

Verification:
- pnpm type-check: PASS
- pnpm lint: PASS (0 errors, 2 existing warnings in scripts/generate-service-image-assets.mjs)
- pnpm build: PASS (98 routes)
- git diff --check: PASS with LF/CRLF warnings only
- route smoke: `/crm/staff-availability`, `/crm/staff-availability?tab=individual`, `/crm/staff-availability?tab=coverage`, and `/manager/staff-availability` redirect unauthenticated traffic to `/login` as expected
- targeted scan: no `style=`, `<style`, `any`, `@ts-ignore`, or lingering `React.ComponentType` references in touched schedule files
- in-app browser visual QA: tool discovery did not expose a browser navigation/screenshot tool in this turn; authenticated visual verification still needs a valid local CRM/manager session.
