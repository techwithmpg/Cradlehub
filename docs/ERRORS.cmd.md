# 🚨 ERRORS — Known Bugs, Failed Approaches & Dead Ends

> **Purpose: Stop agents from repeating the same mistakes.**
> **Rule: If you hit an error, document it here EVEN if you fix it.**
> **Rule: If you tried something that DIDN'T work, document it so no one tries again.**

---

## Format

```
### ERR-[NUMBER]: [Short Title]

**Date:** [DATE]
**Agent:** [Who encountered this]
**Severity:** CRITICAL / HIGH / MEDIUM / LOW
**Status:** OPEN / FIXED / WONTFIX / WORKAROUND

**Symptom:** What happened?
**Root Cause:** Why did it happen?
**Fix / Workaround:** How was it resolved (or why it can't be)?
**Files Involved:** Which files were affected?
**Prevention:** How to avoid this in the future?

---
```

## Error Log

### ERR-001: CRM Stabilization Prompt References Root Governance Files Absent In This Checkout

**Date:** 2026-06-30
**Agent:** Codex
**Severity:** LOW
**Status:** WORKAROUND

**Symptom:** The latest focused CRM stabilization prompt asks agents to read root `PROJECT_CONTEXT.md`, `AGENT_RULES.md`, and `ROADMAP.md`, but this checkout exposes those files under `docs/` instead. Root `AGENTS.md` and `CLAUDE.md` exist.
**Root Cause:** The repository has two documentation/memory layouts: `.context/*.cmd.md` plus `docs/*.cmd.md`, while the latest prompt names root-level files that are not present.
**Fix / Workaround:** Read `docs/PROJECT_CONTEXT.md`, `docs/AGENT_RULES.md`, `docs/ROADMAP.md`, root `AGENTS.md`, root `CLAUDE.md`, and `.context/*.cmd.md`. Current CRM stabilization state has been mirrored into both `.context` and `docs` handoff files.
**Files Involved:** `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, `docs/HANDOFF.cmd.md`, `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.
**Prevention:** Keep `.context` and `docs` handoff files synchronized until one canonical location is chosen.

---

### ERR-002: Checkpoint 1 Sidebar Does Not Complete Header Or Broad System Access

**Date:** 2026-06-30
**Agent:** Codex
**Severity:** MEDIUM
**Status:** OPEN

**Symptom:** The CRM sidebar now has the approved primary destinations and collapsed System Management, but the prompt's full header and broader CRM/CSR system-editing direction are not complete.
**Root Cause:** Checkpoint 1 was deliberately scoped to navigation shell changes. Current `/crm/setup`, `/crm/staff`, and `/crm/staff-availability` page gates remain management-authorized, and several CRM pages still render their own New Booking buttons.
**Fix / Workaround:** Keep System Management aligned with current page gates until a deliberate permission/page-gate/RLS review broadens access. Handle the CRM header in a separate pass and remove duplicate page-level New Booking buttons before adding a persistent global one.
**Files Involved:** `src/components/features/dashboard/nav-config.ts`, `src/components/features/dashboard/sidebar.tsx`, `src/app/(dashboard)/crm/setup/page.tsx`, `src/app/(dashboard)/crm/staff/page.tsx`, `src/app/(dashboard)/crm/staff-availability/page.tsx`, `src/components/features/dashboard/header.tsx`.
**Prevention:** Do not claim the complete CRM shell is done after Checkpoint 1. Continue through the prompt checkpoints and verify protected CRM flows with an authenticated session.

---

## ⛔ Dead Ends (Approaches That Don't Work)

> **If you tried something and it failed, document it here so the next agent doesn't waste time.**

| # | Approach Tried | Why It Failed | Date | Agent |
|---|----------------|---------------|------|-------|
| _none yet_ | — | — | — | — |

---

## 🔄 Common Gotchas (Reference)

> Pre-populated with known issues in the stack. Add project-specific ones as you find them.

| Gotcha | Solution |
|--------|----------|
| Next.js hydration mismatch | Check for browser-only APIs in Server Components. Use `useEffect` + mounted state. |
| Supabase RLS returns empty | Verify RLS policies exist and JWT claims are correct. |
| `pnpm build` fails with module not found | Run `pnpm install` — a dependency may have been added but not installed. |
| shadcn/ui component not rendering | Verify it was added via `pnpm dlx shadcn@latest add [name]` and imports are correct. |
| TypeScript strict mode errors | Don't suppress with `any` or `@ts-ignore`. Fix the type properly. |
| Tailwind classes not applying | Check `content` paths in `tailwind.config.ts`. Restart dev server after config changes. |
| Server Action not working | Ensure `'use server'` is at top of file. Ensure form uses `action=` not `onSubmit`. |
| Supabase types out of date | Regenerate with `pnpm db:types` after any schema change. |
| CSS variables not theming | Check variable names match shadcn/ui's expected format in `globals.css`. |
