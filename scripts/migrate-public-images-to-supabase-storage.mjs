#!/usr/bin/env node
/**
 * Idempotent Hybrid Public Image Backfill Script
 *
 * Migrates Category B assets (service catalog photography & raster Boutique imagery)
 * into Supabase Storage (`public-site-media`) using immutable content-hashed object paths
 * with `cacheControl: "31536000"` and updates PostgreSQL image references while preserving
 * existing copy, pricing, operational metadata, and rollback records.
 *
 * Default mode is --dry-run (safe inspection without Storage or DB mutations).
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const VALID_TARGETS = new Set(["LOCAL", "TEST", "STAGING", "PRODUCTION"]);
const PUBLIC_MEDIA_BUCKET = "public-site-media";
const CACHE_CONTROL_SECONDS = "31536000";
const MIME_BY_EXT = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

const BOUTIQUE_HERO_SOURCE = "/images/boutique/boutique-hero.webp";
const BOUTIQUE_PRODUCT_ITEMS = [
  {
    id: "ginger-oil",
    title: "Ginger Oil",
    sourcePath: "/images/boutique/ginger-oil.webp",
    altText: "Cradle Ginger Oil amber apothecary bottle",
  },
  {
    id: "borneol-oil",
    title: "Borneol Oil",
    sourcePath: "/images/boutique/borneol-oil.webp",
    altText: "Cradle Borneol Oil amber bottle with mint leaves",
  },
  {
    id: "linen-spray",
    title: "Linen Spray",
    sourcePath: "/images/boutique/linen-spray.webp",
    altText: "Cradle Linen Spray amber mist bottle beside folded towels",
  },
  {
    id: "gift-certificate",
    title: "Gift Certificate",
    sourcePath: "/images/boutique/gift-certificate.webp",
    altText: "Cradle Wellness Living forest green and gold ribbon Gift Certificate",
  },
  {
    id: "calm-evening-duo",
    title: "Calm Evening Duo",
    sourcePath: "/images/spa/service-aromatherapy.jpg",
    altText: "Cradle Calm Evening Duo wellness set",
  },
  {
    id: "sanctuary-body-trilogy",
    title: "Sanctuary Ritual Trio",
    sourcePath: "/images/spa/service-hot-stone.jpg",
    altText: "Cradle Sanctuary Ritual Trio wellness essentials",
  },
];

const BOUTIQUE_COLLECTION_ITEMS = [
  {
    id: "relax-unwind",
    title: "Relax & Unwind",
    sourcePath: "/images/boutique/linen-spray.webp",
    altText: "Linen spray and warm candlelight for relaxation",
  },
  {
    id: "home-spa-essentials",
    title: "Home Spa Essentials",
    sourcePath: "/images/boutique/boutique-hero.webp",
    altText: "Cradle amber bottles and rolled towel home spa essentials",
  },
  {
    id: "gift-wellness-sets",
    title: "Gift & Wellness Sets",
    sourcePath: "/images/boutique/gift-certificate.webp",
    altText: "Cradle Gift Certificate and curated wellness sets",
  },
];

function parseArgs(argv) {
  const opts = {
    target: "",
    execute: false,
    force: false,
    verifyUrls: false,
    scope: "all", // all | services | boutique
    sourceDir: join(process.cwd(), "public", "images"),
    reportFile: "",
    confirmProduction: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") opts.execute = true;
    else if (arg === "--dry-run") opts.execute = false;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--verify-urls") opts.verifyUrls = true;
    else if (arg.startsWith("--target=")) opts.target = arg.slice("--target=".length).trim().toUpperCase();
    else if (arg === "--target" && argv[i + 1]) {
      opts.target = argv[i + 1].trim().toUpperCase();
      i += 1;
    } else if (arg.startsWith("--scope=")) opts.scope = arg.slice("--scope=".length).trim().toLowerCase();
    else if (arg.startsWith("--source-dir=")) opts.sourceDir = resolve(arg.slice("--source-dir=".length));
    else if (arg === "--source-dir" && argv[i + 1]) {
      opts.sourceDir = resolve(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--report-file=")) opts.reportFile = resolve(arg.slice("--report-file=".length));
    else if (arg.startsWith("--confirm-production=")) {
      opts.confirmProduction = arg.slice("--confirm-production=".length).trim();
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/migrate-public-images-to-supabase-storage.mjs [options]

Options:
  --target=LOCAL|TEST|STAGING|PRODUCTION   Required database/Storage environment target
  --dry-run                                Inspect & plan only (default)
  --execute                                Perform Storage uploads & PostgreSQL updates
  --scope=all|services|boutique            Asset scope to process (default: all)
  --source-dir=<path>                      Root directory holding local image assets (default: ./public/images)
  --force                                  Re-upload/update even if Storage URL is already assigned
  --verify-urls                            Verify public URLs via HTTP HEAD during execution
  --report-file=<path>                     Write JSON plan/rollback report to path
  --confirm-production=CONFIRM_PRODUCTION_IMAGE_BACKFILL
                                           Required alongside --target=PRODUCTION --execute`);
      process.exit(0);
    }
  }

  return opts;
}

function loadEnvFallback() {
  for (const candidate of [".env.local", ".env"]) {
    const full = join(process.cwd(), candidate);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function assertTargetSafety(opts) {
  if (!VALID_TARGETS.has(opts.target)) {
    throw new Error(
      `STOP: Explicit --target=LOCAL|TEST|STAGING|PRODUCTION is required (received "${opts.target || "none"}").`
    );
  }

  if (opts.target === "PRODUCTION" && opts.execute) {
    if (opts.confirmProduction !== "CONFIRM_PRODUCTION_IMAGE_BACKFILL") {
      throw new Error(
        "STOP: Refusing PRODUCTION execution without --confirm-production=CONFIRM_PRODUCTION_IMAGE_BACKFILL."
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (url) {
    const isLocalhost = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
    if (opts.target === "LOCAL" && !isLocalhost && opts.execute) {
      throw new Error(
        `STOP: --target=LOCAL cannot --execute against non-local Supabase host (${new URL(url).host}).`
      );
    }
    if (opts.target === "PRODUCTION" && isLocalhost) {
      throw new Error("STOP: --target=PRODUCTION cannot point to a localhost Supabase URL.");
    }
  }
}

function resolveLocalAssetFile(sourceDir, relativeImagePath) {
  const normalized = relativeImagePath.replace(/^\/images\//, "").replace(/^\/+/, "");
  const candidates = [
    join(sourceDir, normalized),
    join(process.cwd(), "public", "images", normalized),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

function buildPublicStorageUrl(supabaseUrl, storagePath) {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${storagePath}`;
}

function sha256Short(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function isSupabasePublicMediaUrl(url, supabaseUrl) {
  if (typeof url !== "string" || !url.trim()) return false;
  const trimmed = url.trim();
  const base = supabaseUrl.replace(/\/+$/, "");
  return (
    trimmed.startsWith(`${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/`) ||
    trimmed.includes(`/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/`)
  );
}

async function ensureStorageObject(supabase, storagePath, buffer, contentType, force) {
  const { error } = await supabase.storage.from(PUBLIC_MEDIA_BUCKET).upload(storagePath, buffer, {
    contentType,
    cacheControl: CACHE_CONTROL_SECONDS,
    upsert: Boolean(force),
  });

  if (!error) return { uploaded: true };
  const msg = String(error.message ?? "").toLowerCase();
  // Content-addressed object already present in bucket is idempotent
  if (msg.includes("already exists") || msg.includes("duplicate") || error.statusCode === "409") {
    return { uploaded: false, alreadyPresentInBucket: true };
  }
  throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
}

async function main() {
  loadEnvFallback();
  const opts = parseArgs(process.argv.slice(2));
  assertTargetSafety(opts);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const hasRemoteCredentials = Boolean(supabaseUrl && serviceRoleKey);

  if (opts.execute && !hasRemoteCredentials) {
    throw new Error(
      "STOP: --execute requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment or .env.local."
    );
  }

  const supabase = hasRemoteCredentials
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  const manifestPath = join(process.cwd(), "src", "data", "service-images.json");
  const serviceManifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const report = {
    generatedAt: new Date().toISOString(),
    target: opts.target,
    mode: opts.execute ? "EXECUTE" : "DRY_RUN",
    scope: opts.scope,
    sourceDir: opts.sourceDir,
    bucket: PUBLIC_MEDIA_BUCKET,
    cacheControl: CACHE_CONTROL_SECONDS,
    services: [],
    boutique: [],
    rollbackSql: [],
    summary: {
      plannedUploads: 0,
      skippedAlreadyMigrated: 0,
      missingSourceFiles: 0,
      executedUploads: 0,
      dbUpdates: 0,
      errors: 0,
    },
  };

  // Load existing DB rows when credentials are available (read-only inspection during dry-run)
  const dbServicesById = new Map();
  let existingBoutiqueSection = null;
  const existingBoutiqueAssets = [];

  if (supabase) {
    try {
      if (opts.scope === "all" || opts.scope === "services") {
        const { data, error } = await supabase.from("services").select("id, name, image_url, image_alt");
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
          dbServicesById.set(row.id, row);
        }
      }
      if (opts.scope === "all" || opts.scope === "boutique") {
        const [{ data: sec }, { data: assets }] = await Promise.all([
          supabase.from("public_site_sections").select("*").eq("section_key", "boutique").maybeSingle(),
          supabase
            .from("public_site_assets")
            .select("*")
            .in("section_key", ["boutique_product", "boutique_collection"]),
        ]);
        existingBoutiqueSection = sec ?? null;
        for (const asset of assets ?? []) existingBoutiqueAssets.push(asset);
      }
    } catch (err) {
      if (opts.execute) throw err;
      console.warn(
        `[backfill:dry-run] Warning: Could not inspect ${opts.target} DB rows (${err instanceof Error ? err.message : String(err)}); planning from local manifest only.`
      );
    }
  }

  // 1. Service Catalog Backfill
  if (opts.scope === "all" || opts.scope === "services") {
    for (const entry of serviceManifest) {
      const sourceFile = resolveLocalAssetFile(opts.sourceDir, entry.imageUrl);
      if (!sourceFile) {
        report.summary.missingSourceFiles += 1;
        report.services.push({
          id: entry.id,
          name: entry.name,
          status: "missing_source",
          expectedSource: entry.imageUrl,
        });
        continue;
      }

      const buffer = readFileSync(sourceFile);
      const ext = extname(sourceFile).toLowerCase() || ".webp";
      const contentType = MIME_BY_EXT[ext] ?? "image/webp";
      const hash = sha256Short(buffer);
      const slug = String(entry.slug || entry.id).replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      const storagePath = `service-images/${entry.id}/${slug}-${hash}${ext}`;
      const existingRow = dbServicesById.get(entry.id);
      const previousUrl = existingRow?.image_url ?? null;
      const targetUrl = supabaseUrl
        ? buildPublicStorageUrl(supabaseUrl, storagePath)
        : `<SUPABASE_URL>/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${storagePath}`;

      if (!opts.force && previousUrl && isSupabasePublicMediaUrl(previousUrl, supabaseUrl) && previousUrl.includes(hash)) {
        report.summary.skippedAlreadyMigrated += 1;
        report.services.push({
          id: entry.id,
          name: entry.name,
          status: "skipped_existing",
          storagePath,
          publicUrl: previousUrl,
        });
        continue;
      }

      report.summary.plannedUploads += 1;

      if (!opts.execute) {
        report.services.push({
          id: entry.id,
          name: entry.name,
          status: "planned",
          sourceFile,
          bytes: buffer.byteLength,
          storagePath,
          previousUrl,
          targetUrl,
        });
        continue;
      }

      try {
        const uploadRes = await ensureStorageObject(supabase, storagePath, buffer, contentType, opts.force);
        if (uploadRes.uploaded) report.summary.executedUploads += 1;

        const updatePayload = {
          image_url: targetUrl,
          ...(existingRow?.image_alt?.trim() ? {} : { image_alt: entry.imageAlt }),
        };
        const { error: dbError } = await supabase
          .from("services")
          .update(updatePayload)
          .eq("id", entry.id);
        if (dbError) throw new Error(dbError.message);

        report.summary.dbUpdates += 1;
        report.rollbackSql.push(
          `UPDATE public.services SET image_url = ${previousUrl === null ? "NULL" : `'${previousUrl.replace(/'/g, "''")}'`} WHERE id = '${entry.id}';`
        );

        let headStatus = null;
        if (opts.verifyUrls) {
          const headRes = await fetch(targetUrl, { method: "HEAD" });
          headStatus = headRes.status;
        }

        report.services.push({
          id: entry.id,
          name: entry.name,
          status: "migrated",
          storagePath,
          publicUrl: targetUrl,
          previousUrl,
          bytes: buffer.byteLength,
          headStatus,
        });
      } catch (err) {
        report.summary.errors += 1;
        report.services.push({
          id: entry.id,
          name: entry.name,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 2. Boutique Hero, Products & Collections Backfill
  if (opts.scope === "all" || opts.scope === "boutique") {
    const heroFile = resolveLocalAssetFile(opts.sourceDir, BOUTIQUE_HERO_SOURCE);
    if (!heroFile) {
      report.summary.missingSourceFiles += 1;
      report.boutique.push({ kind: "hero", id: "boutique", status: "missing_source", expectedSource: BOUTIQUE_HERO_SOURCE });
    } else {
      const buffer = readFileSync(heroFile);
      const ext = extname(heroFile).toLowerCase() || ".webp";
      const contentType = MIME_BY_EXT[ext] ?? "image/webp";
      const hash = sha256Short(buffer);
      const storagePath = `boutique/hero/wellness-hero-${hash}${ext}`;
      const previousUrl = existingBoutiqueSection?.image_url ?? null;
      const targetUrl = supabaseUrl
        ? buildPublicStorageUrl(supabaseUrl, storagePath)
        : `<SUPABASE_URL>/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${storagePath}`;

      if (!opts.force && previousUrl && isSupabasePublicMediaUrl(previousUrl, supabaseUrl) && previousUrl.includes(hash)) {
        report.summary.skippedAlreadyMigrated += 1;
        report.boutique.push({ kind: "hero", id: "boutique", status: "skipped_existing", storagePath, publicUrl: previousUrl });
      } else {
        report.summary.plannedUploads += 1;
        if (!opts.execute) {
          report.boutique.push({
            kind: "hero",
            id: "boutique",
            status: "planned",
            sourceFile: heroFile,
            bytes: buffer.byteLength,
            storagePath,
            previousUrl,
            targetUrl,
          });
        } else {
          try {
            const uploadRes = await ensureStorageObject(supabase, storagePath, buffer, contentType, opts.force);
            if (uploadRes.uploaded) report.summary.executedUploads += 1;
            const prevMeta =
              existingBoutiqueSection?.metadata && typeof existingBoutiqueSection.metadata === "object"
                ? existingBoutiqueSection.metadata
                : {};
            const { error: secErr } = await supabase.from("public_site_sections").upsert(
              {
                section_key: "boutique",
                title: existingBoutiqueSection?.title ?? "Wellness at Home",
                subtitle:
                  existingBoutiqueSection?.subtitle ??
                  "Premium care essentials, botanical oils, linen mists, and gift certificates from Cradle Wellness Living in Bacolod.",
                image_url: targetUrl,
                is_enabled: existingBoutiqueSection?.is_enabled ?? true,
                metadata: {
                  ...prevMeta,
                  imageAltText: "Cradle Boutique botanical massage oils and glowing lantern",
                },
              },
              { onConflict: "section_key" }
            );
            if (secErr) throw new Error(secErr.message);
            report.summary.dbUpdates += 1;
            report.boutique.push({ kind: "hero", id: "boutique", status: "migrated", storagePath, publicUrl: targetUrl });
          } catch (err) {
            report.summary.errors += 1;
            report.boutique.push({
              kind: "hero",
              id: "boutique",
              status: "error",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    const assetTargets = [
      ...BOUTIQUE_PRODUCT_ITEMS.map((item) => ({
        ...item,
        kind: "product",
        sectionKey: "boutique_product",
        metaKey: "productId",
      })),
      ...BOUTIQUE_COLLECTION_ITEMS.map((item) => ({
        ...item,
        kind: "collection",
        sectionKey: "boutique_collection",
        metaKey: "collectionId",
      })),
    ];

    for (const item of assetTargets) {
      const sourceFile = resolveLocalAssetFile(opts.sourceDir, item.sourcePath);
      if (!sourceFile) {
        report.summary.missingSourceFiles += 1;
        report.boutique.push({ kind: item.kind, id: item.id, status: "missing_source", expectedSource: item.sourcePath });
        continue;
      }

      const buffer = readFileSync(sourceFile);
      const ext = extname(sourceFile).toLowerCase() || ".webp";
      const contentType = MIME_BY_EXT[ext] ?? "image/webp";
      const hash = sha256Short(buffer);
      const folder = item.kind === "collection" ? `boutique/collections/${item.id}` : `boutique/products/${item.id}`;
      const storagePath = `${folder}/${item.id}-${hash}${ext}`;
      const existingRow = existingBoutiqueAssets.find(
        (row) => row.section_key === item.sectionKey && row.metadata?.[item.metaKey] === item.id
      );
      const previousUrl = existingRow?.image_url ?? null;
      const targetUrl = supabaseUrl
        ? buildPublicStorageUrl(supabaseUrl, storagePath)
        : `<SUPABASE_URL>/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${storagePath}`;

      if (!opts.force && previousUrl && isSupabasePublicMediaUrl(previousUrl, supabaseUrl) && previousUrl.includes(hash)) {
        report.summary.skippedAlreadyMigrated += 1;
        report.boutique.push({ kind: item.kind, id: item.id, status: "skipped_existing", storagePath, publicUrl: previousUrl });
        continue;
      }

      report.summary.plannedUploads += 1;
      if (!opts.execute) {
        report.boutique.push({
          kind: item.kind,
          id: item.id,
          status: "planned",
          sourceFile,
          bytes: buffer.byteLength,
          storagePath,
          previousUrl,
          targetUrl,
        });
        continue;
      }

      try {
        const uploadRes = await ensureStorageObject(supabase, storagePath, buffer, contentType, opts.force);
        if (uploadRes.uploaded) report.summary.executedUploads += 1;
        if (existingRow) {
          const { error: updErr } = await supabase
            .from("public_site_assets")
            .update({ image_url: targetUrl, alt_text: item.altText, is_enabled: true })
            .eq("id", existingRow.id);
          if (updErr) throw new Error(updErr.message);
        } else {
          const { error: insErr } = await supabase.from("public_site_assets").insert({
            section_key: item.sectionKey,
            title: item.title,
            alt_text: item.altText,
            image_url: targetUrl,
            is_enabled: true,
            metadata: { [item.metaKey]: item.id },
          });
          if (insErr) throw new Error(insErr.message);
        }
        report.summary.dbUpdates += 1;
        report.boutique.push({ kind: item.kind, id: item.id, status: "migrated", storagePath, publicUrl: targetUrl });
      } catch (err) {
        report.summary.errors += 1;
        report.boutique.push({
          kind: item.kind,
          id: item.id,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (opts.reportFile) {
    mkdirSync(dirname(opts.reportFile), { recursive: true });
    writeFileSync(opts.reportFile, JSON.stringify(report, null, 2));
  }

  console.log(
    JSON.stringify(
      {
        target: report.target,
        mode: report.mode,
        scope: report.scope,
        sourceDir: report.sourceDir,
        summary: report.summary,
        sampleServices: report.services.slice(0, 3),
        sampleBoutique: report.boutique.slice(0, 3),
      },
      null,
      2
    )
  );

  if (report.summary.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
