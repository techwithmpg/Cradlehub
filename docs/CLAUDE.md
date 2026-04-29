# CLAUDE.md — Claude Code Agent Instructions

> **This file is read automatically by Claude Code at the start of every session.**

---

## Identity

You are working on `[PROJECT_NAME]` — a [brief description] built by Malcom P. Gwanmesia (MPG Technologies).

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase · pnpm

---

## ⚠️ MANDATORY: Before You Write ANY Code

```bash
# STEP 1: Read ALL context files (DO NOT SKIP)
cat .context/CHANGELOG.cmd.md
cat .context/CURRENT_TASK.cmd.md
cat .context/DECISIONS.cmd.md
cat .context/ERRORS.cmd.md
cat .context/HANDOFF.cmd.md
cat ROADMAP.md
cat PROJECT_CONTEXT.md
```

**If you skip this step, you WILL duplicate work or break things other agents built.**

---

## ⚠️ MANDATORY: After You Write ANY Code

```bash
# STEP 1: Verify your work
pnpm build          # Must pass with 0 errors
pnpm lint           # Must pass with 0 warnings
pnpm type-check     # Must pass

# STEP 2: Update context files (DO NOT SKIP)
# → Append to .context/CHANGELOG.cmd.md
# → Update .context/CURRENT_TASK.cmd.md
# → Update .context/HANDOFF.cmd.md
# → Check off completed items in ROADMAP.md
```

---

## Working Conventions

### File Creation
- All source code goes in `src/`
- Components: `src/components/features/[domain]/[component-name].tsx`
- Utilities: `src/lib/utils/[utility-name].ts`
- Types: `src/types/[domain].ts`
- Validations: `src/lib/validations/[domain].ts`
- Server Actions: `src/app/[route]/actions.ts`

### Code Standards
- TypeScript strict mode — no `any`, no `@ts-ignore`
- Server Components by default — `'use client'` only for interactivity
- Use `cn()` for conditional class names (from `@/lib/utils`)
- Import paths use `@/` alias (maps to `src/`)
- All async operations must have error handling
- All forms use React Hook Form + Zod
- All database queries use Supabase typed client

### Naming
- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database: `snake_case`
- Zod schemas: `camelCaseSchema`

### Git Commits
- Use conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, style, test, chore, perf
- One logical change per commit

---

## Key Project Files

| File | Purpose |
|------|---------|
| `PROJECT_CONTEXT.md` | Single source of truth for entire project |
| `AGENT_RULES.md` | Rules every agent must follow |
| `ROADMAP.md` | Development progress tracker |
| `.context/CHANGELOG.cmd.md` | Append-only log of all changes |
| `.context/CURRENT_TASK.cmd.md` | What's currently being worked on |
| `.context/DECISIONS.cmd.md` | Architecture decisions with rationale |
| `.context/ERRORS.cmd.md` | Known bugs, failed approaches |
| `.context/HANDOFF.cmd.md` | Notes for the next agent session |
| `docs/DB_SCHEMA.md` | Database schema documentation |

---

## Common Tasks

### Add a new shadcn/ui component
```bash
pnpm dlx shadcn@latest add [component-name]
```

### Create a new database migration
```bash
# Create migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# After writing SQL, apply it
pnpm db:migrate
```

### Generate Supabase types
```bash
pnpm db:types
# This updates src/types/supabase.ts
```

---

## Anti-Patterns to Avoid

- ❌ Don't use `useEffect` for data fetching — use Server Components
- ❌ Don't use inline styles — use Tailwind
- ❌ Don't use `console.log` — use a logger or remove
- ❌ Don't create God components (200+ lines) — split them
- ❌ Don't duplicate logic — extract to shared utils/hooks
- ❌ Don't commit `.env.local` — use `.env.example`
- ❌ Don't skip error handling — every try needs a meaningful catch
- ❌ Don't use `any` type — define proper types
- ❌ Don't modify shadcn/ui components in `src/components/ui/` — override with wrapper components instead

---

## Troubleshooting

### Build fails after changes
```bash
pnpm type-check  # Check for type errors first
pnpm lint --fix  # Auto-fix lint issues
pnpm build       # Retry build
```

### Supabase connection issues
1. Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and keys
2. Verify Supabase project is running: `npx supabase status`
3. Check RLS policies if queries return empty results

### Hydration errors
- Ensure Server Components don't use hooks or browser APIs
- Wrap client-only code in `'use client'` components
- Use `useEffect` with mounted state check for browser-only operations
