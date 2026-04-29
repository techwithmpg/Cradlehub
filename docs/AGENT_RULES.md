# 📏 AGENT RULES — Law of the Codebase

> **This file is the constitution. No agent — human or AI — is exempt.**
> **Violations are not bugs. They are architectural debt with compound interest.**

---

## 🔒 Rule 0: The Context Protocol (Non-Negotiable)

Every AI agent session follows this exact lifecycle. No exceptions.

```
┌─────────────────────────────────────────────────┐
│              AGENT SESSION LIFECYCLE             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. READ    → All .context/*.cmd.md files       │
│  2. READ    → PROJECT_CONTEXT.md                │
│  3. READ    → ROADMAP.md (find current task)    │
│  4. PLAN    → State what you will do            │
│  5. EXECUTE → Do the work                       │
│  6. TEST    → Verify it works (build + lint)    │
│  7. UPDATE  → Write to .context/*.cmd.md        │
│  8. COMMIT  → Clean, atomic commit              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Pre-Flight Checklist (Before ANY Code Change)

```markdown
- [ ] Read .context/CHANGELOG.cmd.md (what's been done)
- [ ] Read .context/CURRENT_TASK.cmd.md (what's in progress)
- [ ] Read .context/DECISIONS.cmd.md (why things are the way they are)
- [ ] Read .context/ERRORS.cmd.md (what failed before — don't repeat it)
- [ ] Read .context/HANDOFF.cmd.md (notes from last agent)
- [ ] Read ROADMAP.md (what's next)
- [ ] Identify my task from the roadmap
- [ ] Write my intent to CURRENT_TASK.cmd.md BEFORE starting
```

### Post-Flight Checklist (After ANY Code Change)

```markdown
- [ ] Run `pnpm build` — must pass with zero errors
- [ ] Run `pnpm lint` — must pass with zero warnings
- [ ] Run `pnpm type-check` — must pass
- [ ] Update .context/CHANGELOG.cmd.md with what I did
- [ ] Update .context/CURRENT_TASK.cmd.md (clear or update status)
- [ ] Update .context/ERRORS.cmd.md if I hit any issues
- [ ] Update .context/HANDOFF.cmd.md with notes for next agent
- [ ] Update ROADMAP.md — check off completed items
- [ ] Update PROJECT_CONTEXT.md status table if phase/sprint changed
- [ ] Commit with conventional commit message
```

---

## 📖 Clean Code Principles (Robert C. Martin)

> These are not suggestions. They are the engineering standard.

### 1. Meaningful Names (Chapter 2)

```typescript
// ❌ BAD — What is d? What is 34?
const d = 34;
const list1 = getList();

// ✅ GOOD — Names reveal intent
const maxRetryAttempts = 34;
const activeSubscriptions = getActiveSubscriptions();
```

**Rules:**
- Names must reveal intent — if you need a comment to explain a variable, rename it
- Use pronounceable, searchable names
- Avoid encodings (no Hungarian notation, no `I` prefix for interfaces)
- Class names are nouns: `User`, `Subscription`, `PaymentProcessor`
- Method names are verbs: `createUser`, `validatePayment`, `sendNotification`
- One word per concept: don't mix `fetch`, `retrieve`, `get` for the same action

### 2. Functions (Chapter 3)

```typescript
// ❌ BAD — Does too many things, unclear purpose
async function processData(data: any, flag: boolean, type: string) {
  // 150 lines of mixed concerns...
}

// ✅ GOOD — Small, one purpose, descriptive name
async function validateMembershipApplication(
  application: MembershipApplication
): Promise<ValidationResult> {
  const errors = checkRequiredFields(application);
  if (errors.length > 0) return { valid: false, errors };

  const isDuplicate = await checkForDuplicateApplication(application.email);
  if (isDuplicate) return { valid: false, errors: ['Duplicate application'] };

  return { valid: true, errors: [] };
}
```

**Rules:**
- Functions should do ONE thing
- Maximum 20 lines per function (aim for 5-15)
- Maximum 3 parameters (use an object for more)
- No boolean flag arguments — split into two functions
- Functions should either DO something or ANSWER something, never both
- No side effects — if the name says `checkPassword`, it must not also initialize a session
- Extract try/catch into its own function

### 3. Comments (Chapter 4)

```typescript
// ❌ BAD — Redundant comments that parrot the code
// Set the name
const name = user.name;

// ❌ BAD — Journal comments, TODO novels
// Added 2024-01-15 by Malcom: This function was created because...
// TODO: Maybe we should refactor this someday when we have time

// ✅ GOOD — Explains WHY, not WHAT
// Supabase RLS requires the user_id claim from JWT, not the auth.uid()
// because multi-tenant queries filter on organization membership
const userId = session.user.id;

// ✅ GOOD — Warning of consequence
// WARNING: This deletes cascade — removing an org deletes ALL members
await supabase.from('organizations').delete().eq('id', orgId);
```

**Rules:**
- Don't comment bad code — rewrite it
- Comments explain WHY, never WHAT
- Delete commented-out code (that's what git is for)
- Use JSDoc only for public API functions

### 4. Error Handling (Chapter 7)

```typescript
// ❌ BAD — Silent failure, generic catch
try {
  await saveUser(data);
} catch (e) {
  console.log(e);
}

// ✅ GOOD — Typed errors, meaningful handling, no silent failures
class DuplicateEmailError extends AppError {
  constructor(email: string) {
    super(`Account with email ${email} already exists`, 'DUPLICATE_EMAIL', 409);
  }
}

async function createAccount(data: CreateAccountInput): Promise<Account> {
  const existing = await findByEmail(data.email);
  if (existing) throw new DuplicateEmailError(data.email);

  return await insertAccount(data);
}
```

**Rules:**
- Write try-catch-finally first, then fill in the logic
- Use custom error classes with error codes
- Never return `null` from functions — use Result types or throw
- Never pass `null` as a function argument
- Log errors at the boundary, not at every level
- Don't use exceptions for control flow

### 5. The Boy Scout Rule

> **"Leave the code cleaner than you found it."**

Every agent must fix ONE small thing they notice — a typo, a missing type, a dead import. Just one. Non-negotiable.

### 6. DRY — Don't Repeat Yourself

If you write the same logic twice, extract it. Period.

```typescript
// ❌ BAD — Duplicated validation in two places
// src/app/members/create/page.tsx has email validation
// src/app/members/edit/page.tsx has the SAME email validation

// ✅ GOOD — Single source of truth
// src/lib/validations/member.ts
export const memberSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});
```

### 7. SOLID Principles

| Principle | Rule | Example |
|-----------|------|---------|
| **S**ingle Responsibility | One component = one reason to change | `MemberList` only lists members. It doesn't also handle search. |
| **O**pen/Closed | Extend behavior without modifying existing code | Use composition and props, not if/else chains |
| **L**iskov Substitution | Subtypes must be substitutable | If `AdminUser extends User`, any code using `User` must work with `AdminUser` |
| **I**nterface Segregation | Don't force dependence on unused methods | Split large interfaces into focused ones |
| **D**ependency Inversion | Depend on abstractions, not concretions | Use dependency injection, not hard-coded imports |

---

## 🏛️ Architecture Rules

### File Size Limits

| File Type | Max Lines | Action if Exceeded |
|-----------|-----------|-------------------|
| Component | 200 | Extract sub-components |
| Utility | 150 | Split into focused modules |
| Page (Next.js) | 100 | Extract to components + server actions |
| Hook | 100 | Decompose into smaller hooks |
| Type file | 200 | Split by domain |
| API route | 80 | Extract handler logic to service layer |

### Component Architecture

```
src/components/
├── ui/                    # shadcn/ui primitives (DON'T modify these)
├── features/              # Domain components (business logic)
│   ├── members/
│   │   ├── member-list.tsx
│   │   ├── member-card.tsx
│   │   └── member-form.tsx
│   └── dashboard/
│       ├── stats-overview.tsx
│       └── recent-activity.tsx
└── shared/                # Cross-domain reusable (layout, loading, etc.)
    ├── page-header.tsx
    ├── data-table.tsx
    └── empty-state.tsx
```

### Data Flow Pattern

```
Page (Server Component)
  → fetch data via Supabase server client
  → pass data as props to Client Components
  → Client Components handle interactivity
  → Server Actions handle mutations
  → revalidatePath() or router.refresh() after mutations
```

### Import Order (Enforced by ESLint)

```typescript
// 1. React / Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { z } from 'zod';
import { format } from 'date-fns';

// 3. Internal: lib / utils
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// 4. Internal: components
import { Button } from '@/components/ui/button';
import { MemberCard } from '@/components/features/members/member-card';

// 5. Internal: types / constants
import type { Member } from '@/types/member';
import { ROLES } from '@/constants/roles';
```

---

## 🔀 Git Conventions

### Commit Messages (Conventional Commits)

```
<type>(<scope>): <short description>

[optional body]

[optional footer — references .context/ updates]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change that neither fixes nor adds
- `docs` — Documentation only
- `style` — Formatting, missing semicolons (no code change)
- `test` — Adding or fixing tests
- `chore` — Build, tooling, dependencies
- `perf` — Performance improvement

**Examples:**
```
feat(members): add member invite flow with email validation
fix(auth): resolve redirect loop on expired session
refactor(dashboard): extract stats cards into separate components
docs(context): update CHANGELOG after completing auth module
```

### Branch Strategy

```
main                    ← Production-ready (protected)
├── develop             ← Integration branch
│   ├── feat/auth-flow
│   ├── feat/member-crud
│   └── fix/nav-hydration
```

---

## 🛑 Anti-Patterns (Instant Red Flags)

| If You See This... | Do This Instead |
|---------------------|-----------------|
| `any` type | Define a proper type or use `unknown` |
| `// @ts-ignore` | Fix the type error |
| `console.log` in committed code | Use a proper logger or remove |
| Inline styles | Use Tailwind classes |
| `useEffect` for data fetching | Use Server Components or React Query |
| Direct DOM manipulation | Use React state and refs |
| God component (300+ lines) | Extract into smaller components |
| Copy-pasted logic | Extract to shared utility/hook |
| `fetch` inside `'use client'` for initial data | Move to Server Component |
| Hardcoded strings (URLs, keys, labels) | Use constants or env vars |
| Nested ternaries | Use early returns or switch/if-else |
| `.env` committed to git | Use `.env.local` + `.env.example` |
| No error boundary | Add error.tsx at route segment level |
| No loading state | Add loading.tsx at route segment level |

---

## 📐 Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Files & folders | kebab-case | `member-card.tsx` |
| Components | PascalCase | `MemberCard` |
| Functions | camelCase | `validateMember()` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Types / Interfaces | PascalCase | `MemberProfile` |
| Database tables | snake_case | `church_members` |
| Database columns | snake_case | `first_name` |
| CSS variables | kebab-case | `--primary-color` |
| Environment variables | SCREAMING_SNAKE | `NEXT_PUBLIC_SUPABASE_URL` |
| Zod schemas | camelCase + Schema | `memberSchema` |
| Server Actions | camelCase + Action | `createMemberAction` |

---

## 🧪 Testing Standards

### What MUST Be Tested

- All Zod validation schemas
- All utility/helper functions
- All Server Actions (happy path + error path)
- All custom hooks
- Critical user flows (integration tests)

### What DOESN'T Need Tests

- shadcn/ui components (already tested upstream)
- Simple pass-through components
- Static pages with no logic
- Type definitions

### Test File Convention

```
src/lib/utils/format-date.ts        → tests/lib/utils/format-date.test.ts
src/hooks/use-members.ts            → tests/hooks/use-members.test.ts
src/lib/validations/member.ts       → tests/lib/validations/member.test.ts
```

---

## 🤖 AI Agent Specific Rules

### You MUST:

1. **Read all `.context/` files before ANY code change** — no exceptions
2. **Update `.context/` files after ANY code change** — no exceptions
3. **Follow the roadmap** — don't skip ahead, don't improvise
4. **Ask before creating new patterns** — document in DECISIONS.cmd.md first
5. **Run `pnpm build && pnpm lint`** before declaring anything "done"
6. **Write atomic commits** — one concern per commit
7. **Leave a HANDOFF note** — the next agent depends on it

### You MUST NOT:

1. **Modify files outside your current task scope** — unless it's the Boy Scout Rule (one small fix)
2. **Install new dependencies without documenting WHY** in DECISIONS.cmd.md
3. **Delete or restructure `.context/` files** — they are the shared memory
4. **Skip error handling** — every async operation must have a catch
5. **Leave TODO comments without a roadmap reference** — `// TODO(ROADMAP-1.3): implement pagination`
6. **Create files without exports** — dead code is deleted code
7. **Make breaking changes without updating HANDOFF** — you'll strand the next agent
