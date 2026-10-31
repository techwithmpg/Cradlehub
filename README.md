# CradleHub

**One connected workspace for running a multi-branch wellness business.**

CradleHub is a full-stack operations platform designed around the people who keep a service business moving: customers booking appointments, front-desk teams coordinating the day, service professionals delivering care, drivers managing home visits, and managers making operational decisions.

Rather than treating bookings, staff, dispatch, and reporting as isolated tools, CradleHub brings these workflows into a shared operational system.

**Built by MPG Technologies** · **Next.js / React / TypeScript / PostgreSQL** · **Production-connected, actively developed**

## What it does

| Workspace | Representative capabilities |
| --- | --- |
| **Customer experience** | Online service discovery, appointment booking, booking tracking, and branch information |
| **CRM & front desk** | Daily work queues, customer records, booking management, service progress, and payment workflows |
| **Scheduling & workforce** | Staff schedules, attendance records, service assignment, and role-specific workspaces |
| **Home services & dispatch** | Off-site service coordination, driver jobs, maps, and dispatch workflows |
| **Management & finance** | Branch oversight, operational reporting, financial workflows, and payroll-related surfaces |
| **Digital presence** | Service catalogue, public website content, and marketing administration |

> **Scope note:** The repository contains multiple product workstreams at different stages of verification and release. A documented module or application route is not, by itself, evidence that a feature is enabled or production-ready.

## How the workflows connect

A booking is more than a calendar entry. It can affect staff availability, room allocation, service progress, dispatch, payments, and management reporting. CradleHub is designed to help teams handle these dependencies in one workflow.

~~~text
Customer booking
       |
       v
CRM / front-desk coordination
       |
       +----> Scheduling and staff assignment
       |                 |
       |                 v
       |           Service delivery
       |                 |
       +----> Home-service dispatch (when applicable)
       |                 |
       v                 v
  Payment workflow -> Operational reporting
~~~

## Engineering approach

CradleHub is both a working business product and an ongoing engineering effort. Its architecture prioritizes:

- **End-to-end ownership:** Interfaces, application logic, APIs, database operations, and deployment are developed as parts of the same workflow.
- **Data integrity:** PostgreSQL-backed domain records, server-side logic, typed interfaces, validation, and controlled state transitions.
- **Access boundaries:** Supabase authentication, row-level security, and role- and branch-aware application paths.
- **Operational visibility:** Dedicated CRM, management, staff, and driver experiences, with Supabase Realtime used selectively where it adds value.
- **User-centered design:** Responsive interfaces tailored to operational roles, with attention to reducing clicks, ambiguity, and unnecessary handoffs.
- **Verification before release:** Type checking, linting, automated tests, build checks, and review-based change control.

These are engineering goals and implementation patterns, not a blanket claim that every workflow has passed live-environment validation.

## Technology stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui |
| **Application** | Next.js Server Actions and route handlers |
| **Database & identity** | Supabase, PostgreSQL, Auth, row-level security, database functions/RPCs |
| **Data & media** | Supabase Realtime and Storage where applicable |
| **Integrations** | Google Maps Platform for location-aware operational interfaces |
| **Testing & quality** | Vitest, React Testing Library, TypeScript, ESLint |
| **Delivery** | Git, GitHub, Vercel |

### Architecture at a glance

~~~text
Public booking  |  CRM  |  Owner / Manager  |  Staff / Driver
                         |
             Next.js application
          (UI, Server Actions, APIs)
                         |
             Supabase platform
        (Auth, PostgreSQL, RLS, RPCs)
                         |
         Realtime / Storage / integrations
           (only where required)
~~~

## Local development

**Requirements:** Node.js 24.x, pnpm 10.33.2, and access to an approved development environment.

~~~bash
git clone https://github.com/techwithmpg/Cradlehub.git
cd Cradlehub
pnpm install --frozen-lockfile
pnpm dev
~~~

Configuration and credentials are environment-specific and are not included in this README. Do not point development or testing commands at an unverified database target.

### Quality checks

~~~bash
pnpm type-check
pnpm lint
pnpm format:check
pnpm test -- --run
pnpm build
~~~

Database wrapper commands are defined in `package.json`. Run them only after identifying the target environment and confirming the required authorization.

## Project stewardship

CradleHub supports real operational workflows, so changes require more than a passing local build.

- **`main` is production-connected.** A merge or push may trigger a deployment.
- Work is prepared and reviewed on isolated branches rather than pushed casually to `main`.
- Production data, schema, authentication, storage, and secrets are protected by explicit change controls.
- Repository implementation, automated test results, and live production verification are treated as distinct kinds of evidence.
- Screenshots, test fixtures, and documentation must not expose real customer or staff information.

### Maintainer documentation

The following references contain the detailed engineering context, operating rules, and current workstream status:

- [AI context and current authorization](AI_CONTEXT.md)
- [Repository agent and contributor rules](AGENTS.md)
- [Active governance manifest](docs/20-CHATGPT-LIVE-CONTEXT.md)
- [Project and workstream status](docs/13-PROJECT-STATUS.md)
- [System map](docs/02-CURRENT-SYSTEM-MAP.md)
- [Production safety contract](docs/05-PRODUCTION-SAFETY.md)

---

**CradleHub** is developed by **MPG Technologies** with a focus on practical software that makes day-to-day service operations clearer, more connected, and easier to manage.
