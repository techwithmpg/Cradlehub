# Cradle Boutique B1 — Frozen Stage Scope and Stop Conditions

Date: 2026-11-07 · Repository: techwithmpg/Cradlehub · Track: Web ONLY.

## Authority
Owner explicitly authorized B1 on `stage/boutique-b1-foundation-20261107` from freshly resolved accepted main `be22a262b2298103a71f5cf33905f8f010dc9e89`. This is an isolated review branch; existing Web C5 Marketing Pass 4 work is paused, not closed or merged. No Desktop work is included. `main` remains accepted production-connected baseline.

## Allowed implementation
1. Gated, read-only Cradle Boutique presentation in existing `/products` using approved warm-ivory/forest/gold design, responsive cards, search/category filtering, product details and an **in-memory demonstration cart**. Mobile has a sticky View Cart CTA and no boutique bottom navigation; desktop uses a discreet drawer.
2. Existing public nav receives Boutique link only when preview flag is enabled. Preserve old `/products` presentation and SEO when disabled.
3. New read-only `/owner/boutique` and `/crm/boutique` previews use shared UI with five tabs. Explicit server authorization required: Owner only for Owner route; canonical CRM with resolved assigned branch for CRM route; no manager or marketer privilege through a generic workspace check.
4. Presentation-only typed fixtures: Ginger Oil PHP 300, Borneol Oil PHP 300, Linen Spray PHP 250 (owner-supplied). No inventory availability, verified photos, SKUs, real quantities, public gift offers, or customer data. Mark placeholders and disabled purchase flow honestly.
5. Tests for preview gate, catalog search/filter/cart calculations, role access and unchanged baseline routes, plus governance and stage handoff documentation.

## Feature gate
`NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW=true` is **local/TEST preview only**, default false. B1 does not modify deployed env configuration. Public flag is not authorization; server auth/branch checks remain mandatory.

## Hard exclusions
No migrations (creation/application), data writes, Auth/RLS/Storage changes, new API writers, persistent carts, live orders, payment activity, cash flow, stock reservations/deductions, certificate issuance/redemption, refunds, receipts, customer mutations, deployment, main push or merge. Do not copy Kimi backend or other store source.

## Evidence and handoff
Record exact base/head, paths, focused Vitest, `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, `git diff --check`, responsive browser acceptance, branch/role denials and environment limitations. A configured command is not proof of execution. Independent reviewer verdict required; owner must separately authorize merge and later stages. Production remains unverified.
