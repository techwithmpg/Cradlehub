import fs from "node:fs";
import path from "node:path";
const manifest = JSON.parse(fs.readFileSync(new URL("../src/data/service-images.json", import.meta.url), "utf8"));

const root = process.cwd();
const seen = new Set();
const missing = [];
const duplicates = [];

for (const service of manifest) {
  if (seen.has(service.filename)) duplicates.push(service.filename);
  seen.add(service.filename);
  const filePath = path.join(root, "public", service.imageUrl.replace(/^\//, ""));
  if (!fs.existsSync(filePath)) missing.push(service.filename);
}

if (duplicates.length > 0) {
  console.error(`Duplicate service image filenames: ${duplicates.join(", ")}`);
}

if (missing.length > 0) {
  console.error(`Missing ${missing.length} service image files:`);
  for (const filename of missing) console.error(`- ${filename}`);
} else {
  console.log(`All ${manifest.length} service image files are present.`);
}

process.exitCode = duplicates.length > 0 || missing.length > 0 ? 1 : 0;
