/**
 * Repository-only inventory of public website images.
 * It does not inspect live Supabase rows or establish usage rights.
 * Run: node scripts/marketing-media-inventory.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const imageRoot = join(root, "public", "images");
const sourceRoot = join(root, "src");
const outputPath = join(
  root,
  "docs",
  "reports",
  "DIGITAL-MARKETING-REPOSITORY-IMAGE-INVENTORY-2026-10-19.csv"
);

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function csv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const sourceFiles = walk(sourceRoot).filter((path) => /\.(?:ts|tsx|js|jsx|json|css)$/.test(path));
const sourceText = sourceFiles.map((path) => ({
  path: relative(root, path).split(sep).join("/"),
  text: readFileSync(path, "utf8"),
}));
const images = walk(imageRoot).filter((path) => /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(path));
const rows = [];

for (const path of images.sort()) {
  const bytes = readFileSync(path);
  const publicUrl = `/${relative(join(root, "public"), path).split(sep).join("/")}`;
  const metadata = await sharp(bytes, { failOn: "error" }).metadata().catch(() => null);
  const references = sourceText
    .filter(({ text }) => text.includes(publicUrl))
    .map(({ path }) => path)
    .join("; ");
  const isBrand = publicUrl.startsWith("/images/brand/") || publicUrl.includes("cradle-logo");
  rows.push([
    publicUrl,
    bytes.length,
    createHash("sha256").update(bytes).digest("hex"),
    metadata?.width ?? "",
    metadata?.height ?? "",
    metadata?.exif ? "yes" : "no",
    references || "No direct string reference; dynamic database use unverified",
    "Committed repository file; original creator/source not established",
    "No file-specific license, ownership, or release proof found in repository inspection",
    isBrand ? "Reserved: verify official identity and rights before replacement" : "Pending rights clearance; no replacement supplied",
  ]);
}

const header = [
  "public_url",
  "bytes",
  "sha256",
  "width",
  "height",
  "embedded_exif",
  "direct_source_references",
  "known_source",
  "rights_evidence",
  "replacement_status",
];
writeFileSync(outputPath, [header, ...rows].map((row) => row.map(csv).join(",")).join("\n") + "\n");
console.log(`${rows.length} repository images inventoried: ${outputPath}`);
