import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(new URL("../src/data/service-images.json", import.meta.url), "utf8"));
const strictLocal = process.argv.includes("--strict-local");
const root = process.cwd();

const requiredCategoryAFiles = [
  "/images/services/default-service.webp",
  "/images/boutique/boutique-hero.webp",
  "/images/boutique/ginger-oil.webp",
  "/images/boutique/borneol-oil.webp",
  "/images/boutique/linen-spray.webp",
  "/images/boutique/gift-certificate.webp",
  "/images/brand/cradle-wellness-living-logo.png",
  "/images/brand/cradle-wellness-living-mark.png",
  "/images/brand/cradle-logo-gold.png",
  "/images/brand/cradle-logo-mark.svg",
  "/images/spa/hero.jpg",
  "/images/spa/hero-portrait.jpg",
  "/images/spa/service-aromatherapy.jpg",
  "/images/spa/service-hot-stone.jpg",
  "/images/spa/contact.jpg",
  "/images/spa/booking.jpg",
];

const seenIds = new Set();
const seenFilenames = new Set();
const duplicateIds = [];
const duplicateFilenames = [];
const invalidManifestEntries = [];
const missingLocalCategoryB = [];

for (const service of manifest) {
  if (!service?.id || typeof service.imageUrl !== "string" || !service.imageUrl.startsWith("/images/services/")) {
    invalidManifestEntries.push(String(service?.id ?? service?.name ?? "unknown"));
  }
  if (seenIds.has(service.id)) duplicateIds.push(service.id);
  seenIds.add(service.id);

  if (seenFilenames.has(service.filename)) duplicateFilenames.push(service.filename);
  seenFilenames.add(service.filename);

  const filePath = path.join(root, "public", service.imageUrl.replace(/^\//, ""));
  if (!fs.existsSync(filePath)) missingLocalCategoryB.push(service.filename);
}

const missingCategoryA = requiredCategoryAFiles.filter(
  (relPath) => !fs.existsSync(path.join(root, "public", relPath.replace(/^\//, "")))
);

if (duplicateIds.length > 0) {
  console.error(`Duplicate service IDs in manifest: ${duplicateIds.join(", ")}`);
}
if (duplicateFilenames.length > 0) {
  console.error(`Duplicate service image filenames: ${duplicateFilenames.join(", ")}`);
}
if (invalidManifestEntries.length > 0) {
  console.error(`Invalid manifest entries: ${invalidManifestEntries.join(", ")}`);
}
if (missingCategoryA.length > 0) {
  console.error(`Missing ${missingCategoryA.length} required Category A static fallback/brand files:`);
  for (const relPath of missingCategoryA) console.error(`- ${relPath}`);
}

const strictFailure = strictLocal && missingLocalCategoryB.length > 0;
if (strictFailure) {
  console.error(`Missing ${missingLocalCategoryB.length} local service image files (--strict-local):`);
  for (const filename of missingLocalCategoryB) console.error(`- ${filename}`);
} else {
  const presentCount = manifest.length - missingLocalCategoryB.length;
  console.log(
    `Hybrid image integrity OK: ${requiredCategoryAFiles.length} Category A static files present; ` +
      `${manifest.length} service manifest IDs verified (${presentCount} local, ${missingLocalCategoryB.length} Storage-backed/fallback-safe).`
  );
}

process.exitCode =
  duplicateIds.length > 0 ||
  duplicateFilenames.length > 0 ||
  invalidManifestEntries.length > 0 ||
  missingCategoryA.length > 0 ||
  strictFailure
    ? 1
    : 0;
