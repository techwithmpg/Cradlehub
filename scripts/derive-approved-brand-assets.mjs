import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Exact crop/resize of the owner-approved PNG. Never trace or regenerate artwork.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "public/images/brand");
const source = path.join(brand, "cradle-wellness-living-logo.png");
const mark = path.join(brand, "cradle-wellness-living-mark.png");
const metadata = await sharp(source).metadata();
if (metadata.width !== 1536 || metadata.height !== 1024 || !metadata.hasAlpha) {
  throw new Error("Expected the approved 1536 × 1024 transparent PNG.");
}

// The lettering starts below y=760; the complete emblem ends at y=749.
await sharp(source)
  .extract({ left: 340, top: 20, width: 860, height: 736 })
  .png()
  .toFile(mark);

const forest = "#163A2B";
async function icon(size, inset = 0.06) {
  const contentSize = Math.round(size * (1 - 2 * inset));
  const emblem = await sharp(mark)
    .resize(contentSize, contentSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: forest } })
    .composite([{ input: emblem, gravity: "centre" }])
    .png()
    .toBuffer();
}

for (const [name, size, inset] of [
  ["icon.png", 512, 0.06],
  ["apple-icon.png", 180, 0.15],
  ["manifest-icon-192.png", 192, 0.15],
  ["manifest-icon-512.png", 512, 0.15],
  ["staff-manifest-icon-192.png", 192, 0.15],
  ["staff-manifest-icon-512.png", 512, 0.15],
]) {
  await fs.writeFile(path.join(root, "public", name), await icon(size, inset));
}

// Standard ICO directory, with lossless PNG entries at native browser sizes.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => icon(size, 0)));
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((data, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(data.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await fs.writeFile(path.join(root, "public/favicon.ico"), Buffer.concat([directory, ...images]));
console.log("Derived emblem and browser/application icons from approved artwork.");
