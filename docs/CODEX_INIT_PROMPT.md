# 🚀 CODEX INITIALIZATION PROMPT

> **Copy everything below the line and paste it into Codex (or Claude Code) to initialize the project.**
> **Replace all `[PLACEHOLDERS]` with your actual values before running.**

---

## ✏️ Fill These In First

```
PROJECT_NAME = [your-project-name]
PROJECT_DESCRIPTION = [one sentence describing what this project does]
SUPABASE_URL = [your supabase project url]
SUPABASE_ANON_KEY = [your supabase anon key]
```

---

## 📋 The Prompt (Copy Below This Line)

---

You are initializing a professional-grade Next.js 15 project. This is Phase 0 of the roadmap. Follow every step precisely. Do not skip steps. Do not improvise. Run each command and verify it succeeds before moving on.

### PROJECT DETAILS

- **Name:** [PROJECT_NAME]
- **Description:** [PROJECT_DESCRIPTION]
- **Author:** Malcom P. Gwanmesia (MPG Technologies)
- **Stack:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase, pnpm

---

### STEP 1: Create Next.js Project

```bash
pnpm create next-app@latest [PROJECT_NAME] \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

cd [PROJECT_NAME]
```

---

### STEP 2: Install Core Dependencies

```bash
# UI & Forms
pnpm add @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers lucide-react class-variance-authority clsx tailwind-merge date-fns

# Dev dependencies
pnpm add -D @types/node prettier eslint-config-prettier vitest @testing-library/react @testing-library/jest-dom jsdom supabase
```

---

### STEP 3: Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

When prompted, select:
- Style: **New York**
- Base color: **Neutral**
- CSS variables: **Yes**

Then add essential components:

```bash
pnpm dlx shadcn@latest add button card input label toast dialog dropdown-menu separator avatar badge sheet scroll-area skeleton table tabs
```

---

### STEP 4: Create Project Directory Structure

```bash
# Source directories
mkdir -p src/components/features
mkdir -p src/components/shared
mkdir -p src/lib/supabase
mkdir -p src/lib/utils
mkdir -p src/lib/validations
mkdir -p src/hooks
mkdir -p src/types
mkdir -p src/constants

# Infrastructure
mkdir -p .context
mkdir -p docs
mkdir -p supabase/migrations
mkdir -p tests/lib
mkdir -p tests/hooks
mkdir -p tests/components
mkdir -p public/images
```

---

### STEP 5: Create Utility Files

**Create `src/lib/utils/index.ts`:**
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  return crypto.randomUUID();
}
```

**Create `src/lib/supabase/client.ts`:**
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Create `src/lib/supabase/server.ts`:**
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component
            // where cookies can't be set. Ignored for read operations.
          }
        },
      },
    }
  );
}
```

**Create `src/lib/supabase/middleware.ts`:**
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

**Create `src/middleware.ts`:**
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

### STEP 6: Create App Shell

**Create `src/app/layout.tsx`:**
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "[PROJECT_NAME]",
  description: "[PROJECT_DESCRIPTION]",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Create `src/app/error.tsx`:**
```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
```

**Create `src/app/loading.tsx`:**
```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
```

**Create `src/app/not-found.tsx`:**
```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <h2 className="text-2xl font-semibold">Page Not Found</h2>
      <p className="text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
```

**Create `src/app/page.tsx`:**
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">[PROJECT_NAME]</CardTitle>
          <CardDescription className="text-base">
            [PROJECT_DESCRIPTION]
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button size="lg">Get Started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

---

### STEP 7: Create Environment Files

**Create `.env.example`:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Create `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=[SUPABASE_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[SUPABASE_ANON_KEY]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### STEP 8: Create Type Definitions

**Create `src/types/index.ts`:**
```typescript
// Re-export all types from this barrel file
export type { AppError } from "./errors";
```

**Create `src/types/errors.ts`:**
```typescript
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}
```

---

### STEP 9: Create Constants

**Create `src/constants/index.ts`:**
```typescript
export const APP_NAME = "[PROJECT_NAME]" as const;
export const APP_DESCRIPTION = "[PROJECT_DESCRIPTION]" as const;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  SETTINGS: "/settings",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
```

---

### STEP 10: Configure Project Settings

**Update `tsconfig.json`** — ensure strict mode:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Create `.prettierrc`:**
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Create `.prettierignore`:**
```
node_modules
.next
dist
pnpm-lock.yaml
```

**Add scripts to `package.json`:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:run": "vitest run",
    "db:migrate": "npx supabase db push",
    "db:reset": "npx supabase db reset",
    "db:seed": "npx supabase db seed",
    "db:types": "npx supabase gen types --lang=typescript --local > src/types/supabase.ts"
  }
}
```

---

### STEP 11: Copy Context Files

Now copy the following project governance files into the repo root. These files should already exist (they were prepared beforehand). If they don't exist, create them:

```bash
# These files form the AI Agent Memory System
# Copy PROJECT_CONTEXT.md, AGENT_RULES.md, ROADMAP.md, CLAUDE.md to project root

# Create .context/ cmd files
touch .context/CHANGELOG.cmd.md
touch .context/CURRENT_TASK.cmd.md
touch .context/DECISIONS.cmd.md
touch .context/ERRORS.cmd.md
touch .context/HANDOFF.cmd.md

# Create docs placeholders
touch docs/ARCHITECTURE.md
touch docs/API_REFERENCE.md
touch docs/DB_SCHEMA.md
```

---

### STEP 12: Update .gitignore

Append these to `.gitignore`:

```
# Environment
.env.local
.env.*.local

# Supabase
supabase/.temp/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

**IMPORTANT: Do NOT gitignore `.context/` — these files must be committed and shared.**

---

### STEP 13: Verify Build

```bash
pnpm build
```

This MUST pass with zero errors. If it fails, fix every error before proceeding.

```bash
pnpm lint
```

This MUST pass with zero warnings. Fix any issues.

---

### STEP 14: First Commit

```bash
git add -A
git commit -m "chore: initialize project with full scaffold

- Next.js 15 (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn/ui (New York style)
- Supabase client/server/middleware setup
- Project governance: context files, agent rules, roadmap
- Error boundaries, loading states, not-found page
- ESLint + Prettier configuration
- Custom error classes, constants, utility functions

Phase 0 tasks 0.1-0.14 complete."
```

---

### STEP 15: Update Context Files

After everything passes, update these files:

1. **ROADMAP.md** — Check off items 0.1 through 0.14, mark Phase 0 as ✅
2. **.context/CHANGELOG.cmd.md** — Add first entry documenting the initialization
3. **.context/CURRENT_TASK.cmd.md** — Set status to IDLE, note Phase 0 complete
4. **.context/HANDOFF.cmd.md** — Write handoff notes for Phase 1 agent
5. **PROJECT_CONTEXT.md** — Update status table: Phase 1, Sprint 1, date

Then commit again:

```bash
git add -A
git commit -m "docs(context): complete Phase 0 — project scaffold verified and documented"
```

---

### ✅ DONE

Phase 0 is complete. The project is initialized, builds cleanly, and is ready for Phase 1 (Authentication & Core Layout).

The next agent should:
1. Read all `.context/` files
2. Read ROADMAP.md
3. Start with task `1.1`
