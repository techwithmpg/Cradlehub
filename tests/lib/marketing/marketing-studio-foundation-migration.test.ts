import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260803042453_marketing_studio_foundation.sql"),
  "utf8"
).toLowerCase();

describe("marketing studio foundation migration", () => {
  it("adds the digital marketer role without granting live public-site writes", () => {
    expect(sql).toContain("digital_marketer");
    expect(sql).toContain("staff_system_role_check");
    expect(sql).not.toContain("public_site_sections_marketer");
    expect(sql).not.toContain("public_site_assets_marketer");
    expect(sql).not.toContain(
      "get_auth_role() in ('owner', 'digital_marketer')\n  with check (get_auth_role() in ('owner', 'digital_marketer')"
    );
  });

  it("creates draft, revision, media, brand, and SEO tables with explicit grants", () => {
    [
      "create table if not exists public.marketing_content_drafts",
      "create table if not exists public.marketing_content_revisions",
      "create table if not exists public.marketing_media_assets",
      "create table if not exists public.marketing_brand_settings",
      "create table if not exists public.marketing_seo_settings",
    ].forEach((statement) => expect(sql).toContain(statement));

    [
      "grant select, insert, update, delete on table public.marketing_content_drafts to authenticated",
      "grant select, insert on table public.marketing_content_revisions to authenticated",
      "grant select, insert, update, delete on table public.marketing_media_assets to authenticated",
      "grant select, insert, update, delete on table public.marketing_brand_settings to authenticated",
      "grant select, insert, update, delete on table public.marketing_seo_settings to authenticated",
      "revoke all on table public.marketing_content_drafts from anon",
    ].forEach((statement) => expect(sql).toContain(statement));
  });

  it("enables RLS and prevents digital marketers from publishing directly", () => {
    expect(sql).toContain("alter table public.marketing_content_drafts enable row level security");
    expect(sql).toContain('create policy "marketing_content_drafts_owner_all"');
    expect(sql).toContain('create policy "marketing_content_drafts_marketer_insert"');
    expect(sql).toContain("status in ('draft', 'submitted', 'changes_requested')");
    expect(sql).toContain("published_by is null");
    expect(sql).toContain("published_at is null");
    expect(sql).not.toContain("auth.role()");
  });

  it("adds a public media bucket with authenticated owner/marketer write policies", () => {
    expect(sql).toContain("values ('public-site-media', 'public-site-media', true)");
    expect(sql).toContain('create policy "public_site_media_public_read"');
    expect(sql).toContain('create policy "public_site_media_marketing_insert"');
    expect(sql).toContain('create policy "public_site_media_marketing_update"');
    expect(sql).toContain('create policy "public_site_media_marketing_delete"');
    expect(sql).toContain("public.get_auth_role() in ('owner', 'digital_marketer')");
  });
});
