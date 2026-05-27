import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "src", "data", "service-images.json");
const ATTRIBUTIONS_PATH = path.join(ROOT, "src", "data", "service-image-attributions.json");
const CACHE_ROOT = path.join(ROOT, "docs", "service-images", "source-cache");
const OPENVERSE_URL = "https://api.openverse.org/v1/images/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BLOCKED_WORDS = [
  "car",
  "automotive",
  "theatre",
  "theater",
  "concert",
  "restaurant",
  "food",
  "surgery",
  "medical",
  "histologic",
  "histology",
  "nevus",
  "cells",
  "dermal",
  "congenital",
  "microscopy",
  "microscope",
  "blood",
  "nude",
  "naked",
  "sexy",
  "erotic",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    batches: [],
    startBatch: null,
    endBatch: null,
    licenses: ["by", "cc0", "pdm"],
    pageSize: 40,
    overwrite: false,
    delay: 250,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--batch") parsed.batches.push(Number(args[++index]));
    else if (arg === "--start-batch") parsed.startBatch = Number(args[++index]);
    else if (arg === "--end-batch") parsed.endBatch = Number(args[++index]);
    else if (arg === "--licenses") parsed.licenses = args[++index].split(",").map((value) => value.trim());
    else if (arg === "--page-size") parsed.pageSize = Number(args[++index]);
    else if (arg === "--delay") parsed.delay = Number(args[++index]);
    else if (arg === "--overwrite") parsed.overwrite = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.startBatch !== null || parsed.endBatch !== null) {
    const start = parsed.startBatch ?? parsed.endBatch;
    const end = parsed.endBatch ?? parsed.startBatch;
    for (let batch = Math.min(start, end); batch <= Math.max(start, end); batch += 1) {
      parsed.batches.push(batch);
    }
  }

  if (parsed.batches.length === 0) {
    throw new Error("Select at least one batch with --batch or --start-batch/--end-batch.");
  }

  return parsed;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function compactName(name) {
  return name
    .toLowerCase()
    .replaceAll(" w/ ", " with ")
    .replaceAll("+", " plus ")
    .replaceAll("&", " and ")
    .replaceAll("/", " ")
    .replaceAll(" or ", " ")
    .replaceAll(" 60min", "")
    .replaceAll(" 90min", "")
    .split(/\s+/)
    .join(" ");
}

function queryPlan(service) {
  const name = compactName(service.name);
  const category = service.category.toLowerCase();
  const queries = [];

  if (/(manicure|pedicure|mani-pedi|foot spell)/.test(name)) {
    queries.push("spa manicure pedicure hands", "premium nail spa treatment");
  } else if (name.includes("eyelash")) {
    queries.push("eyelash extension beauty spa", "lash beauty treatment spa");
  } else if (name.includes("eyebrow") || name.includes("threading")) {
    queries.push("eyebrow threading beauty spa", "brow treatment spa");
  } else if (name.includes("make up") || name.includes("makeup")) {
    queries.push("makeup beauty salon spa", "professional makeup salon");
  } else if (/(hair|shampoo|keratin|ombre)/.test(name)) {
    queries.push("premium hair salon treatment", "hair spa salon treatment");
  } else if (name.includes("waxing")) {
    queries.push("spa waxing treatment room", "beauty spa treatment room towels");
  } else if (/(laser|pico|tattoo)/.test(name)) {
    queries.push("skincare laser facial spa", "beauty skincare treatment room");
  } else if (/(facial|skin|dermabrasion|oxy|pdt)/.test(name)) {
    queries.push("premium facial spa treatment", "skincare facial spa");
  } else if (/(body scrub|scrub|wrap)/.test(name)) {
    queries.push("spa body scrub treatment", "body scrub spa towels oils");
  } else if (category.includes("party") || category.includes("package") || /(couples|besties)/.test(name)) {
    queries.push("luxury spa group relaxation", "couples spa room massage");
  } else if (name.includes("thai")) {
    queries.push("thai massage spa room", "thai wellness spa mat");
  } else if (name.includes("shiatsu")) {
    queries.push("shiatsu massage spa", "pressure point massage spa");
  } else if (name.includes("ventosa") || name.includes("moxa")) {
    queries.push("cupping therapy spa room", "wellness cupping spa");
  } else if (name.includes("stone")) {
    queries.push("hot stone massage spa", "spa stones massage");
  } else {
    queries.push(`${name} spa`, `${name} wellness`);
  }

  if (category.includes("massage") || name.includes("massage")) {
    queries.push("spa massage room", "premium massage spa");
  } else if (category.includes("salon")) {
    queries.push("premium salon spa", "beauty salon spa");
  } else if (category.includes("skin")) {
    queries.push("skincare spa treatment", "facial spa treatment");
  } else {
    queries.push("premium spa wellness", "spa treatment room");
  }

  return [...new Set(queries)];
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openverseSearch(query, license, pageSize) {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    license,
    aspect_ratio: "wide",
    mature: "false",
    page_size: String(pageSize),
  });
  const response = await fetch(`${OPENVERSE_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Openverse ${response.status} for ${query}`);
  const payload = await response.json();
  return payload.results ?? [];
}

function combinedText(result) {
  const tags = Array.isArray(result.tags)
    ? result.tags.map((tag) => tag?.name).filter(Boolean).join(" ")
    : "";
  return `${result.title ?? ""} ${result.url ?? ""} ${result.foreign_landing_url ?? ""} ${tags}`.toLowerCase();
}

function isUsableCandidate(result, usedIds, usedUrls) {
  if (!result.id || !result.url || usedIds.has(result.id) || usedUrls.has(result.url)) return false;
  if (result.mature === true) return false;
  if (Array.isArray(result.unstable__sensitivity) && result.unstable__sensitivity.length > 0) return false;
  if ((result.width ?? 0) < 900 || (result.height ?? 0) < 500) return false;
  const text = combinedText(result);
  return !BLOCKED_WORDS.some((word) => text.includes(word));
}

function extensionFor(result, contentType) {
  const fromType = contentType?.toLowerCase();
  if (fromType?.includes("png")) return ".png";
  if (fromType?.includes("webp")) return ".webp";
  const urlPath = new URL(result.url).pathname.toLowerCase();
  const extension = path.extname(urlPath);
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return extension;
  return ".jpg";
}

async function downloadCandidate(result) {
  let response;
  try {
    response = await fetch(result.url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    extension: extensionFor(result, contentType),
  };
}

function licenseLabel(result) {
  const license = result.license;
  const version = result.license_version;
  let label = license === "cc0" ? "CC0" : license === "pdm" ? "Public Domain Mark" : "CC BY";
  if (version) label = `${label} ${version}`;
  return label;
}

function attributionFor(service, result, query) {
  return {
    serviceId: service.id,
    serviceName: service.name,
    filename: service.filename,
    imageUrl: service.imageUrl,
    source: "Openverse",
    openverseId: result.id,
    title: result.title,
    creator: result.creator,
    creatorUrl: result.creator_url,
    landingUrl: result.foreign_landing_url,
    originalImageUrl: result.url,
    license: licenseLabel(result),
    licenseUrl: result.license_url,
    attribution: result.attribution,
    query,
    changes: "Cropped/resized to 1200x800 and converted to WebP for CradleHub service cards.",
  };
}

async function sourceService(service, options, usedIds, usedUrls) {
  for (const query of queryPlan(service)) {
    for (const license of options.licenses) {
      await sleep(options.delay);
      let results = [];
      try {
        results = await openverseSearch(query, license, options.pageSize);
      } catch (error) {
        console.warn(`Openverse search failed for "${query}" (${license}): ${error.message}`);
        continue;
      }
      for (const result of results) {
        if (!isUsableCandidate(result, usedIds, usedUrls)) continue;
        const download = await downloadCandidate(result);
        if (!download) continue;
        return { download, attribution: attributionFor(service, result, query) };
      }
    }
  }
  return null;
}

async function main() {
  const options = parseArgs();
  const selected = new Set(options.batches);
  const manifest = await readJson(MANIFEST_PATH, []);
  const attributions = await readJson(ATTRIBUTIONS_PATH, []);
  const usedIds = new Set(attributions.map((entry) => entry.openverseId).filter(Boolean));
  const usedUrls = new Set(attributions.map((entry) => entry.originalImageUrl).filter(Boolean));
  const attributionsByFilename = new Map(attributions.map((entry) => [entry.filename, entry]));
  const failures = [];
  let sourced = 0;

  for (const service of manifest) {
    if (!selected.has(service.batch)) continue;
    const batchDir = path.join(CACHE_ROOT, `batch-${String(service.batch).padStart(2, "0")}`);
    await fs.mkdir(batchDir, { recursive: true });
    const outputBase = path.join(batchDir, service.filename.replace(/\.webp$/, ""));
    const existing = (await fs.readdir(batchDir)).find((name) => name.startsWith(path.basename(outputBase)));
    if (existing && !options.overwrite) continue;

    const sourcedImage = await sourceService(service, options, usedIds, usedUrls);
    if (!sourcedImage) {
      failures.push(service.filename);
      continue;
    }

    const { download, attribution } = sourcedImage;
    const outputPath = `${outputBase}${download.extension}`;
    await fs.writeFile(outputPath, download.buffer);
    attributionsByFilename.set(service.filename, attribution);
    usedIds.add(attribution.openverseId);
    usedUrls.add(attribution.originalImageUrl);
    sourced += 1;
    console.log(`${service.filename} <- ${attribution.title} (${attribution.license})`);
  }

  await writeJson(
    ATTRIBUTIONS_PATH,
    [...attributionsByFilename.values()].sort((a, b) => a.filename.localeCompare(b.filename))
  );
  console.log(`Sourced ${sourced} images from Openverse.`);
  if (failures.length > 0) {
    console.log("No suitable Openverse image found for:");
    for (const filename of failures) console.log(`- ${filename}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
