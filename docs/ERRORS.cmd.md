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

_No errors logged yet. First agent to encounter an issue adds it here._

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
