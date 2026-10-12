import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The approved hands-and-leaves reference was reconstructed with imagegen.
// Extract its gold silhouette, then render every Staff-only variant from one mask.
const root = process.cwd();
const source = path.join(root, "scripts/assets/staff-pwa/forest-gold-source.png");
const output = path.join(root, "public");
const evidence = path.join(root, "docs/pwa/evidence/staff-brand-icons");
const forest = { r: 22, g: 58, b: 43, alpha: 1 }; // #163A2B

const { data, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height } = info;
const count = width * height;
const core = new Uint8Array(count);
const keep = new Uint8Array(count);
const seen = new Uint8Array(count);
const queue = new Uint32Array(count);

for (let p = 0; p < count; p++) {
  const i = p * 3;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  core[p] = Number(r >= 120 && r - g >= 15 && g - b >= 20);
}

// Keep only substantial connected gold forms; discard isolated generation specks.
for (let start = 0; start < count; start++) {
  if (!core[start] || seen[start]) continue;
  let head = 0;
  let tail = 1;
  queue[0] = start;
  seen[start] = 1;
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = Math.floor(p / width);
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x + 1 < width ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y + 1 < height ? p + width : -1,
    ];
    for (const next of neighbors) {
      if (next < 0 || !core[next] || seen[next]) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  if (tail >= 500) {
    for (let i = 0; i < tail; i++) keep[queue[i]] = 1;
  }
}

const rgba = Buffer.alloc(count * 4);
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;
for (let p = 0; p < count; p++) {
  const x = p % width;
  const y = Math.floor(p / width);
  const i = p * 3;
  let alpha = keep[p] ? 255 : 0;
  if (!alpha && x > 0 && x + 1 < width && y > 0 && y + 1 < height) {
    const adjacent = keep[p - 1] || keep[p + 1] || keep[p - width] || keep[p + width];
    if (
      adjacent &&
      data[i] >= 55 &&
      data[i] - data[i + 1] >= 8 &&
      data[i + 1] - data[i + 2] >= 12
    ) {
      alpha = Math.round(Math.min(1, Math.max(0, (data[i] - 55) / 65)) * 255);
    }
  }
  if (!alpha) continue;

  // A subtle warm-gold vertical ramp keeps the master readable at 48 px.
  const t = y / height;
  const j = p * 4;
  rgba[j] = Math.round(255 - 37 * t);
  rgba[j + 1] = Math.round(225 - 62 * t);
  rgba[j + 2] = Math.round(126 - 55 * t);
  rgba[j + 3] = alpha;
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
}
if (maxX < minX) throw new Error("No gold emblem found in Staff PWA source image");

const mark = await sharp(rgba, { raw: { width, height, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toBuffer();

async function transparentMark(size, fill) {
  const edge = Math.round(size * fill);
  return sharp(mark)
    .resize(edge, edge, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();
}

async function icon(size, fill) {
  const emblem = await transparentMark(size, fill);
  const meta = await sharp(emblem).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: forest } })
    .composite([
      {
        input: emblem,
        left: Math.floor((size - meta.width) / 2),
        top: Math.floor((size - meta.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function transparentCanvas(size, fill) {
  const emblem = await transparentMark(size, fill);
  const meta = await sharp(emblem).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: emblem,
        left: Math.floor((size - meta.width) / 2),
        top: Math.floor((size - meta.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await fs.mkdir(evidence, { recursive: true });
const normal192 = await icon(192, 0.74);
const normal512 = await icon(512, 0.74);
const maskable192 = await icon(192, 0.6);
const maskable512 = await icon(512, 0.6);
const files = [
  ["staff-pwa-icon-48-gold.png", await icon(48, 0.74)],
  ["staff-manifest-icon-192.png", maskable192], // cached older manifests label these as any maskable
  ["staff-manifest-icon-512.png", maskable512],
  ["staff-pwa-icon-192-gold.png", normal192],
  ["staff-pwa-icon-512-gold.png", normal512],
  ["staff-pwa-icon-maskable-192-gold.png", maskable192],
  ["staff-pwa-icon-maskable-512-gold.png", maskable512],
  ["staff-pwa-apple-touch-icon-180-gold.png", await icon(180, 0.74)],
  ["staff-pwa-gold-emblem.png", await transparentCanvas(512, 0.95)],
];
for (const [name, bytes] of files) await fs.writeFile(path.join(output, name), bytes);

const previews = [
  { size: 48, left: 44, top: 83, image: await icon(48, 0.74) },
  { size: 72, left: 210, top: 71, image: await icon(72, 0.74) },
  { size: 192, left: 396, top: 11, image: normal192 },
  { size: 512, left: 688, top: 11, image: normal512 },
];
const label = Buffer.from(
  `<svg width="1220" height="560" xmlns="http://www.w3.org/2000/svg"><rect width="1220" height="560" fill="#F7F3EB"/><g font-family="Arial,sans-serif" font-size="18" fill="#163A2B"><text x="44" y="158">48 px</text><text x="210" y="158">72 px</text><text x="396" y="230">192 px</text><text x="688" y="548">512 px</text></g></svg>`
);
const contact = await sharp(label)
  .composite(previews.map(({ left, top, image }) => ({ input: image, left, top })))
  .png()
  .toBuffer();
await fs.writeFile(path.join(evidence, "contact-sheet.png"), contact);
console.log(`Staff PWA assets generated from ${path.relative(root, source)}`);
for (const [name, bytes] of files) console.log(`${name}: ${bytes.length} bytes`);
