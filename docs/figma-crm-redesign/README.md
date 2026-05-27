# Figma CRM Redesign Context

## Purpose

This folder is a structured UI/UX context package for redesigning the CradleHub CRM / Front Desk Workspace in Figma. It explains the current pages, operational workflows, visual direction, redesign constraints, reusable component needs, and ready-to-paste Figma AI prompts.

This package is for presentation-layer planning only. It must not be treated as a business-logic rewrite, route redesign, database redesign, permissions redesign, or workflow replacement.

## How To Use With Figma

Use these files as source context before generating frames in Figma AI:

1. Read the docs in this folder.
2. Upload screenshots of the current CRM pages.
3. Upload any approved mockup direction or reference frames.
4. Paste `06-figma-ai-master-prompt.md` into Figma AI.
5. Generate the reusable design system first.
6. Generate pages one by one using `07-page-by-page-figma-prompts.md`.
7. Implement approved designs back into code safely, preserving existing logic and workflows.

## Screenshots To Add Later

Add current CRM screenshots to:

`docs/figma-crm-redesign/screenshots/current/`

Add approved design direction screenshots or mockups to:

`docs/figma-crm-redesign/screenshots/approved-direction/`

Add final redesigned screenshots to:

`docs/figma-crm-redesign/screenshots/redesigned/`

See `screenshots/README.md` for exact naming conventions.

## Recommended Workflow

1. Read `01-crm-page-map.md` to understand the full CRM workspace.
2. Read `02-crm-ui-style-guide.md` for brand, layout, and responsive direction.
3. Read `03-ui-redesign-rules.md` before making any design decisions.
4. Read `04-existing-workflows-and-functions.md` to preserve the operational flows.
5. Read `05-component-design-system-brief.md` before generating page mockups.
6. Upload screenshots and approved mockup direction to Figma.
7. Paste the master prompt from `06-figma-ai-master-prompt.md`.
8. Generate the design system frame first.
9. Generate page frames one at a time using `07-page-by-page-figma-prompts.md`.
10. Review, approve, and then implement the design back into code without changing business logic.

## Important Boundary

The CRM redesign should improve hierarchy, density, spacing, consistency, readability, and responsive behavior. It should not invent new booking rules, availability rules, payment behavior, dispatch logic, Supabase data structures, RBAC behavior, or route structure.
