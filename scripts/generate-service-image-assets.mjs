import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SERVICE_ROWS_CANDIDATES = [
  process.env.SERVICE_ROWS_SQL,
  "/mnt/data/services_rows (2).sql",
  "C:/Users/eleur/Downloads/services_rows (2).sql",
  path.join(ROOT, "services_rows (2).sql"),
].filter(Boolean);
const CATEGORY_ROWS_CANDIDATES = [
  process.env.SERVICE_CATEGORIES_SQL,
  "/mnt/data/service_categories_rows.sql",
  "C:/Users/eleur/Downloads/service_categories_rows.sql",
  path.join(ROOT, "service_categories_rows.sql"),
].filter(Boolean);

const SOURCE_SERVICE_SQL = process.argv[2] ?? firstExistingPath(SERVICE_ROWS_CANDIDATES);
const SOURCE_CATEGORY_SQL = process.argv[3] ?? firstExistingPath(CATEGORY_ROWS_CANDIDATES);

const PUBLIC_SERVICE_IMAGE_DIR = "public/images/services";
const SERVICE_IMAGE_URL_BASE = "/images/services";
const SERVICE_IMAGE_ABSOLUTE_DIR = "E:/cradlehub/public/images/services";
const FALLBACK_IMAGE_SOURCE = "public/images/spa/booking.jpg";
const FALLBACK_IMAGE_FILE = "_fallback-spa-service.jpg";

const KNOWN_CATEGORY_NAMES = {
  "20046468-5119-4687-8011-223f12f00b5c": { name: "Salon Services", display_order: 2 },
  "255a0d19-e467-4fe3-9a43-7467e7cac913": { name: "Skin Care Services", display_order: 3 },
  "70ae0936-891a-420e-a75c-768c1a1825dd": { name: "Massage Services", display_order: 1 },
  "a1000000-0000-0000-0000-000000000001": { name: "Swedish Massage", display_order: 1 },
  "a1000000-0000-0000-0000-000000000002": { name: "Deep Tissue Massage", display_order: 2 },
  "a1000000-0000-0000-0000-000000000003": { name: "Hot Stone Therapy", display_order: 3 },
  "a1000000-0000-0000-0000-000000000004": { name: "Reflexology", display_order: 4 },
  "a1000000-0000-0000-0000-000000000005": { name: "Facial Treatments", display_order: 5 },
  "a1000000-0000-0000-0000-000000000006": { name: "Body Scrubs & Wraps", display_order: 6 },
  "cc98c754-bc0c-49a0-a15e-84042c4315bd": { name: "Spa Party Packages", display_order: 5 },
  "e935263c-0b73-4395-97d5-65f163395045": { name: "Divine Renewal Packages", display_order: 4 },
};

if (!SOURCE_SERVICE_SQL) {
  throw new Error(
    `Could not find services_rows SQL. Set SERVICE_ROWS_SQL or place the file at one of: ${SERVICE_ROWS_CANDIDATES.join(", ")}`
  );
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function ensureDir(dir) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseInsertRows(sql) {
  const header = sql.match(/INSERT\s+INTO\s+"public"\."([^"]+)"\s*\(([\s\S]*?)\)\s*VALUES\s*/i);
  if (!header) {
    throw new Error("SQL does not look like a supported INSERT INTO public.<table> ... VALUES file.");
  }

  const columns = Array.from(header[2].matchAll(/"([^"]+)"/g)).map((match) => match[1]);
  const valuesStart = header.index + header[0].length;
  const tuples = extractTuples(sql.slice(valuesStart));

  return tuples.map((tuple) => {
    const values = splitTupleValues(tuple).map(parseSqlValue);
    if (values.length !== columns.length) {
      throw new Error(`Column/value mismatch: expected ${columns.length}, got ${values.length}`);
    }
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

function extractTuples(valuesSql) {
  const tuples = [];
  let inString = false;
  let depth = 0;
  let tupleStart = -1;

  for (let i = 0; i < valuesSql.length; i += 1) {
    const char = valuesSql[i];
    const next = valuesSql[i + 1];

    if (char === "'") {
      if (inString && next === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "(") {
      if (depth === 0) tupleStart = i + 1;
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0 && tupleStart !== -1) {
        tuples.push(valuesSql.slice(tupleStart, i));
        tupleStart = -1;
      }
    }
  }

  return tuples;
}

function splitTupleValues(tuple) {
  const values = [];
  let inString = false;
  let start = 0;

  for (let i = 0; i < tuple.length; i += 1) {
    const char = tuple[i];
    const next = tuple[i + 1];

    if (char === "'") {
      if (inString && next === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (!inString && char === ",") {
      values.push(tuple.slice(start, i).trim());
      start = i + 1;
    }
  }

  values.push(tuple.slice(start).trim());
  return values;
}

function parseSqlValue(raw) {
  if (/^null$/i.test(raw)) return null;
  if (/^true$/i.test(raw)) return true;
  if (/^false$/i.test(raw)) return false;

  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  return raw;
}

function categoryMapFromSql(filePath) {
  const map = new Map(
    Object.entries(KNOWN_CATEGORY_NAMES).map(([id, category]) => [id, category])
  );

  if (!filePath || !fs.existsSync(filePath)) {
    return map;
  }

  for (const category of parseInsertRows(readText(filePath))) {
    map.set(category.id, {
      name: category.name,
      display_order: Number(category.display_order ?? 999),
    });
  }

  return map;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bw\//g, " with ")
    .replace(/\+/g, " plus ")
    .replace(/orly/g, "orly")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function serviceVisualBrief(service) {
  const name = service.name.toLowerCase();
  const category = service.category.toLowerCase();

  if (category.includes("spa party")) {
    return "an elegant small-group spa setup with neatly arranged towels, oils, robes, treatment chairs, and premium hospitality details, suggesting a tasteful party package without crowding";
  }

  if (category.includes("divine renewal") || name.includes("package") || name.includes("couples") || name.includes("besties")) {
    if (name.includes("couples") || name.includes("besties")) {
      return "a refined two-person spa suite with side-by-side treatment beds, warm towels, oils, flowers, and calm natural light";
    }
    return "a premium spa ritual scene combining massage, facial, manicure, and foot-care elements in one calm, organized composition";
  }

  if (category.includes("massage") || name.includes("massage")) {
    if (name.includes("hot stone") || name.includes("stone")) {
      return "smooth heated stones arranged on a towel beside a massage bed, with warm oil and a therapist preparing a calm hot stone treatment";
    }
    if (name.includes("hilot")) {
      return "traditional Filipino hilot-inspired bodywork in a serene spa room, with a Filipina therapist using grounded hand placement and warm oil";
    }
    if (name.includes("ventosa") || name.includes("moxa")) {
      return "ventosa cups, warmed towels, and moxa-inspired spa details arranged beside a massage bed, realistic and non-medical";
    }
    if (name.includes("thai")) {
      return "assisted stretching on a floor mat in a refined spa room, therapist guiding a clothed client through calm Thai massage movement";
    }
    if (name.includes("pre natal") || name.includes("prenatal")) {
      return "a gentle prenatal massage setup with supportive pillows, soft linens, and a calm side-lying arrangement, dignified and modest";
    }
    if (name.includes("post natal") || name.includes("postnatal")) {
      return "a gentle postnatal recovery massage setup with soft pillows, warm towels, and a restful spa room mood, dignified and modest";
    }
    if (name.includes("sports")) {
      return "a recovery-focused massage scene with a therapist working on the shoulder and upper back area, clean towels and subtle athletic recovery cues";
    }
    if (name.includes("herbal")) {
      return "warm herbal compress balls, towels, and massage oil prepared beside a spa bed";
    }
    if (name.includes("aroma")) {
      return "aromatic oils, botanical details, and a therapist preparing a soothing full-body massage in soft natural light";
    }
    if (name.includes("foot") || name.includes("reflex")) {
      return "close-up foot massage and reflexology care with clean towels, warm water bowl, and polished spa details";
    }
    return "a calm full-body massage scene with a therapist and modestly draped client on a treatment bed in a refined spa interior";
  }

  if (category.includes("salon")) {
    if (name.includes("manicure") || name.includes("pedicure") || name.includes("mani") || name.includes("pedi") || name.includes("gel polish") || name.includes("orly")) {
      return "a polished nail care station with hands or feet being treated, clean tools, warm towels, neutral polish bottles with no visible labels, and premium spa styling";
    }
    if (name.includes("foot spa") || name.includes("foot scrub")) {
      return "a relaxing foot spa scene with a ceramic basin, scrub texture, towels, and hands providing foot-care treatment";
    }
    if (name.includes("eyelash") || name.includes("lash") || name.includes("eyebrow")) {
      return "a close-up beauty treatment scene focused on lashes or brows, an Asian-looking client resting with eyes closed, clean tools, and soft spa lighting";
    }
    if (name.includes("waxing bikini") || name.includes("brazilian") || name.includes("hollywood")) {
      return "a tasteful waxing treatment preparation scene with covered wax pot, applicators, folded towels, and clean spa room details, no exposed body";
    }
    if (name.includes("waxing")) {
      return "a tasteful waxing service setup with wax applicators, folded towels, clean treatment bed, and discreet body-care details";
    }
    if (name.includes("make up") || name.includes("makeup")) {
      return "a refined makeup service scene with an Asian-looking client, soft brushes, neutral cosmetics without labels, and elegant salon-spa lighting";
    }
    if (name.includes("ear candling")) {
      return "a calm wellness treatment setup with ear candle tools, towels, and a client resting modestly in a spa room, non-medical and serene";
    }
    if (name.includes("color") || name.includes("balayage") || name.includes("ombre") || name.includes("highlights")) {
      return "a premium salon color treatment scene with glossy hair, clean brushes, foil or color tools, and an elegant chair setup";
    }
    if (name.includes("rebond") || name.includes("keratin") || name.includes("kerabond") || name.includes("detox") || name.includes("power dose") || name.includes("hair spa") || name.includes("nourishing")) {
      return "a premium hair treatment scene with glossy healthy hair, treatment mask, clean combs, towels, and a refined salon-spa interior";
    }
    if (name.includes("shampoo") || name.includes("blowdry") || name.includes("hair iron") || name.includes("hair style") || name.includes("hair cut")) {
      return "a refined salon service scene with an Asian-looking client, stylist hands working on clean glossy hair, warm lighting, mirror, and elegant tools";
    }
    return "a premium salon-spa beauty treatment scene with refined tools, clean towels, and warm natural light";
  }

  if (category.includes("skin") || name.includes("facial") || name.includes("laser") || name.includes("scrub") || name.includes("pdt") || name.includes("pico")) {
    if (name.includes("body scrub")) {
      return "a close-up body scrub spa scene with textured scrub, warm towels, oils, and modestly draped treatment setup";
    }
    if (name.includes("laser") || name.includes("pico") || name.includes("tattoo")) {
      return "a refined non-invasive beauty technology setup with handheld treatment device, protective eyewear on a tray, clean towels, and calm spa lighting, no gore";
    }
    if (name.includes("pdt")) {
      return "a serene facial treatment room with soft LED light therapy mood, a client resting with eyes protected, clean towels, and spa-grade skincare tools";
    }
    return "an elegant facial treatment scene with an Asian-looking client resting, esthetician hands applying skincare, clean tools, towels, and soft natural light";
  }

  return "a premium spa wellness scene with clean towels, oils, plants, warm light, and refined treatment-room details";
}

function buildPrompt(service) {
  const visualBrief = serviceVisualBrief(service);
  return [
    "Use case: photorealistic-natural",
    "Asset type: public service card image, horizontal 1200x800, 3:2 aspect ratio",
    `Primary request: Create a unique premium spa/wellness image for the service "${service.name}".`,
    `Service category: ${service.category}`,
    `Scene/backdrop: ${visualBrief}.`,
    "Style/medium: photorealistic premium spa photography, commercially usable, calm, clean, elegant.",
    "Composition/framing: horizontal service-card composition, subject centered with natural negative space, no cropped text or labels.",
    "Lighting/mood: soft natural light, warm calm mood, polished Philippines-based wellness brand aesthetic.",
    "Color palette: soft cream, forest green, warm brown, subtle gold accents, fresh botanical details.",
    "People guidance: when a face is visible, prefer Asian, Filipina, or Asian-looking models; keep all clients modestly draped and non-sexualized.",
    "Constraints: no text, no logo, no watermark, no nudity, no sexualized imagery, no medical gore, no brand labels.",
  ].join("\n");
}

function buildManifest(serviceRows, categories) {
  const baseRows = serviceRows.map((row) => {
    const category = categories.get(row.category_id) ?? {
      name: "Wellness",
      display_order: 999,
    };
    return {
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      category: category.name,
      categoryOrder: category.display_order,
      description: row.description,
      durationMinutes: Number(row.duration_minutes),
      price: Number(row.price),
      isActive: row.is_active === true,
    };
  });

  baseRows.sort((a, b) => {
    const categoryOrderDelta = a.categoryOrder - b.categoryOrder;
    if (categoryOrderDelta !== 0) return categoryOrderDelta;
    const categoryDelta = a.category.localeCompare(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    const nameDelta = a.name.localeCompare(b.name);
    if (nameDelta !== 0) return nameDelta;
    return a.id.localeCompare(b.id);
  });

  const slugCounts = new Map();

  return baseRows.map((row, index) => {
    const baseSlug = slugify(row.name);
    const nextCount = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, nextCount);
    const slug = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
    const prefix = String(index + 1).padStart(3, "0");
    const filename = `${prefix}-${slug}.webp`;
    const imageUrl = `${SERVICE_IMAGE_URL_BASE}/${filename}`;
    const localPath = `${SERVICE_IMAGE_ABSOLUTE_DIR}/${filename}`;
    const imageAlt = `${row.name} service at Cradle Massage and Wellness Spa`;
    const batch = Math.ceil((index + 1) / 10);

    return {
      id: row.id,
      name: row.name,
      slug,
      category: row.category,
      categoryId: row.categoryId,
      filename,
      localPath,
      imageUrl,
      imageAlt,
      batch,
      generationPrompt: buildPrompt({ ...row, slug, filename, imageUrl }),
    };
  });
}

function writeJson(filePath, value) {
  fs.writeFileSync(path.join(ROOT, filePath), `${JSON.stringify(value, null, 2)}\n`);
}

function appManifestEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    slug: entry.slug,
    category: entry.category,
    categoryId: entry.categoryId,
    filename: entry.filename,
    localPath: entry.localPath,
    imageUrl: entry.imageUrl,
    imageAlt: entry.imageAlt,
    batch: entry.batch,
  };
}

function writeText(filePath, value) {
  fs.writeFileSync(path.join(ROOT, filePath), value);
}

function writeBatchFiles(entries) {
  const batches = new Map();
  for (const entry of entries) {
    const batchEntries = batches.get(entry.batch) ?? [];
    batchEntries.push(entry);
    batches.set(entry.batch, batchEntries);
  }

  ensureDir("docs/service-images/batches");

  for (const [batchNumber, batchEntries] of batches) {
    const batchLabel = String(batchNumber).padStart(2, "0");
    const rows = batchEntries
      .map(
        (entry) =>
          `| ${entry.filename} | ${entry.name} | ${entry.category} | ${entry.imageUrl} |`
      )
      .join("\n");
    const prompts = batchEntries
      .map(
        (entry) => `## ${entry.filename}\n\n\`\`\`text\n${entry.generationPrompt}\n\`\`\`\n`
      )
      .join("\n");

    writeText(
      `docs/service-images/batches/batch-${batchLabel}.md`,
      `# Service Image Generation Batch ${batchLabel}\n\n` +
        `Generate these ${batchEntries.length} service images as 1200x800 WebP files. Save the final files in \`${PUBLIC_SERVICE_IMAGE_DIR}/\` using the exact filenames below.\n\n` +
        "| Filename | Service | Category | Public URL |\n" +
        "| --- | --- | --- | --- |\n" +
        `${rows}\n\n` +
        "Shared avoid list for every prompt: no text, no logos, no watermarks, no nudity, no sexualized imagery, no medical gore, no brand labels.\n\n" +
        prompts
    );
  }
}

function writeSql(entries) {
  const updates = entries
    .map(
      (entry) =>
        `UPDATE public.services\n` +
        `SET image_url = ${sqlString(entry.imageUrl)},\n` +
        `    image_alt = ${sqlString(entry.imageAlt)}\n` +
        `WHERE id = ${sqlString(entry.id)};`
    )
    .join("\n\n");

  writeText(
    "supabase/service-images-update.sql",
    "-- CradleHub service image URL backfill.\n" +
      "-- Run after supabase/migrations/20260527000001_add_service_image_fields.sql.\n\n" +
      "BEGIN;\n\n" +
      `${updates}\n\n` +
      "COMMIT;\n"
  );

  writeText(
    "supabase/migrations/20260527000001_add_service_image_fields.sql",
    "-- CradleHub service image fields.\n" +
      "-- Enables public service cards and the booking flow to read per-service imagery from the catalog.\n\n" +
      "ALTER TABLE public.services\n" +
      "  ADD COLUMN IF NOT EXISTS image_url TEXT,\n" +
      "  ADD COLUMN IF NOT EXISTS image_alt TEXT;\n\n" +
      "COMMENT ON COLUMN public.services.image_url IS 'Public image URL for this service, usually /images/services/<filename>.webp.';\n" +
      "COMMENT ON COLUMN public.services.image_alt IS 'Accessible alt text for this service image.';\n"
  );
}

function writeReadme(entries) {
  const batchCount = Math.ceil(entries.length / 10);
  writeText(
    "docs/service-images/README.md",
    "# Service Image System\n\n" +
      `This folder contains the generated handoff for ${entries.length} service images from \`${path.basename(SOURCE_SERVICE_SQL)}\`.\n\n` +
      "## Output Location\n\n" +
      `Final images belong in \`${PUBLIC_SERVICE_IMAGE_DIR}/\` and should be referenced with URLs like \`${SERVICE_IMAGE_URL_BASE}/001-service-name.webp\`.\n\n` +
      "Preferred image spec:\n\n" +
      "- WebP\n" +
      "- 1200x800\n" +
      "- 3:2 aspect ratio\n" +
      "- Premium spa/wellness photography\n" +
      "- No text, logos, watermarks, nudity, sexualized imagery, or medical gore\n\n" +
      "## Files\n\n" +
      "- `src/data/service-images.json` is the app-side service-id manifest.\n" +
      `- \`docs/service-images/batches/\` contains ${batchCount} batch prompt files, 10 services per batch except the last.\n` +
      "- `supabase/migrations/20260527000001_add_service_image_fields.sql` adds `image_url` and `image_alt`.\n" +
      "- `supabase/service-images-update.sql` backfills every service image URL and alt text.\n" +
      `- \`${PUBLIC_SERVICE_IMAGE_DIR}/${FALLBACK_IMAGE_FILE}\` is the runtime fallback image.\n\n` +
      "## Workflow\n\n" +
      "1. Generate images batch by batch from `docs/service-images/batches/batch-XX.md`.\n" +
      `2. Save each final image in \`${PUBLIC_SERVICE_IMAGE_DIR}/\` with the exact manifest filename.\n` +
      "3. Run the migration, then run `supabase/service-images-update.sql` against the linked database.\n" +
      "4. Run `node scripts/check-service-images.mjs` to confirm every manifest file exists.\n" +
      "5. Rebuild the app and spot-check `/services` plus `/book`.\n\n" +
      "The app resolves images in this order: database `image_url`, branch `custom_image_url` where available, generated service-id manifest, then the fallback spa image.\n"
  );
}

function writeCheckScript() {
  writeText(
    "scripts/check-service-images.mjs",
    "import fs from \"node:fs\";\n" +
      "import path from \"node:path\";\n" +
      "const manifest = JSON.parse(fs.readFileSync(new URL(\"../src/data/service-images.json\", import.meta.url), \"utf8\"));\n\n" +
      "const root = process.cwd();\n" +
      "const seen = new Set();\n" +
      "const missing = [];\n" +
      "const duplicates = [];\n\n" +
      "for (const service of manifest) {\n" +
      "  if (seen.has(service.filename)) duplicates.push(service.filename);\n" +
      "  seen.add(service.filename);\n" +
      "  const filePath = path.join(root, \"public\", service.imageUrl.replace(/^\\//, \"\"));\n" +
      "  if (!fs.existsSync(filePath)) missing.push(service.filename);\n" +
      "}\n\n" +
      "if (duplicates.length > 0) {\n" +
      "  console.error(`Duplicate service image filenames: ${duplicates.join(\", \")}`);\n" +
      "}\n\n" +
      "if (missing.length > 0) {\n" +
      "  console.error(`Missing ${missing.length} service image files:`);\n" +
      "  for (const filename of missing) console.error(`- ${filename}`);\n" +
      "} else {\n" +
      "  console.log(`All ${manifest.length} service image files are present.`);\n" +
      "}\n\n" +
      "process.exitCode = duplicates.length > 0 || missing.length > 0 ? 1 : 0;\n"
  );
}

function writeFallbackImage() {
  ensureDir(PUBLIC_SERVICE_IMAGE_DIR);
  const source = path.join(ROOT, FALLBACK_IMAGE_SOURCE);
  const destination = path.join(ROOT, PUBLIC_SERVICE_IMAGE_DIR, FALLBACK_IMAGE_FILE);
  if (fs.existsSync(source) && !fs.existsSync(destination)) {
    fs.copyFileSync(source, destination);
  }
  const gitkeep = path.join(ROOT, PUBLIC_SERVICE_IMAGE_DIR, ".gitkeep");
  if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, "");
}

function main() {
  const serviceRows = parseInsertRows(readText(SOURCE_SERVICE_SQL));
  const categories = categoryMapFromSql(SOURCE_CATEGORY_SQL);
  const manifest = buildManifest(serviceRows, categories);
  const appManifest = manifest.map(appManifestEntry);

  ensureDir("src/data");
  ensureDir("docs/service-images");
  writeFallbackImage();
  writeJson("src/data/service-images.json", appManifest);
  writeBatchFiles(manifest);
  writeSql(appManifest);
  writeReadme(appManifest);
  writeCheckScript();

  console.log(`Parsed ${serviceRows.length} services from ${SOURCE_SERVICE_SQL}`);
  console.log(`Wrote ${appManifest.length} service image manifest entries in ${Math.ceil(appManifest.length / 10)} batches.`);
  if (SOURCE_CATEGORY_SQL) {
    console.log(`Loaded categories from ${SOURCE_CATEGORY_SQL}`);
  }
}

main();
