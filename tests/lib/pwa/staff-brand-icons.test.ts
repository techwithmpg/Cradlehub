import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { statSync } from "node:fs";

const forest = [22, 58, 43, 255];
const icons = [
  ["staff-pwa-icon-48-gold.png", 48],
  ["staff-manifest-icon-192.png", 192],
  ["staff-manifest-icon-512.png", 512],
  ["staff-pwa-icon-192-gold.png", 192],
  ["staff-pwa-icon-512-gold.png", 512],
  ["staff-pwa-icon-maskable-192-gold.png", 192],
  ["staff-pwa-icon-maskable-512-gold.png", 512],
  ["staff-pwa-apple-touch-icon-180-gold.png", 180],
] as const;

describe("Staff PWA forest and gold icon assets", () => {
  it.each(icons)("ships a full-bleed, opaque PNG at the declared size: %s", async (name, size) => {
    const file = `public/${name}`;
    const metadata = await sharp(file).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(size);
    expect(metadata.height).toBe(size);
    expect(statSync(file).size).toBeLessThan(100_000);

    const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const pixel of [0, size - 1, size * (size - 1), size * size - 1]) {
      expect([...data.subarray(pixel * 4, pixel * 4 + 4)]).toEqual(forest);
    }
    let transparentPixels = 0;
    for (let pixel = 0; pixel < size * size; pixel++) {
      if (data[pixel * 4 + 3] !== 255) transparentPixels++;
    }
    expect(transparentPixels).toBe(0);
  });

  it.each([
    ["staff-pwa-icon-maskable-512-gold.png", 512],
    ["staff-manifest-icon-512.png", 512],
  ] as const)("keeps maskable gold within the central safe-zone circle: %s", async (name, size) => {
    const { data } = await sharp(`public/${name}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let goldPixels = 0;
    let largestRadius = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (data[i]! < 100 || data[i]! - data[i + 1]! < 20) continue;
        goldPixels++;
        largestRadius = Math.max(largestRadius, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2));
      }
    }
    expect(goldPixels).toBeGreaterThan(20_000);
    expect(largestRadius).toBeLessThanOrEqual(size / 3);
  });

  it("ships a transparent emblem for the existing Staff loading splash", async () => {
    const file = "public/staff-pwa-gold-emblem.png";
    const metadata = await sharp(file).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    const corner = await sharp(file)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(corner[3]).toBe(0);
  });
});
