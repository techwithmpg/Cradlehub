import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import ImageTracer from "imagetracerjs";

const SOURCE = path.join(process.cwd(), "public/images/images/cradle-logo.png");
const PUBLIC_BRAND_DIR = path.join(process.cwd(), "public/images/brand");
const SRC_BRAND_DIR = path.join(process.cwd(), "src/assets/brand");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isBackground(r, g, b, a) {
  return a > 245 && r > 245 && g > 245 && b > 245;
}

function findBounds(png) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isBackground(r, g, b, a)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Could not detect logo bounds from source PNG.");
  }

  return { minX, minY, maxX, maxY };
}

function clampRect(rect, width, height) {
  return {
    minX: Math.max(0, rect.minX),
    minY: Math.max(0, rect.minY),
    maxX: Math.min(width - 1, rect.maxX),
    maxY: Math.min(height - 1, rect.maxY),
  };
}

function expandRect(rect, padding, width, height) {
  return clampRect(
    {
      minX: rect.minX - padding,
      minY: rect.minY - padding,
      maxX: rect.maxX + padding,
      maxY: rect.maxY + padding,
    },
    width,
    height,
  );
}

function findMarkSplitX(png, bounds) {
  const { width, data } = png;
  const boxWidth = bounds.maxX - bounds.minX + 1;
  const counts = new Array(boxWidth).fill(0);

  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    let count = 0;
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isBackground(r, g, b, a)) count++;
    }
    counts[x - bounds.minX] = count;
  }

  const runs = [];
  let start = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 0) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      runs.push({ start, end: i - 1, len: i - start });
      start = -1;
    }
  }
  if (start !== -1) runs.push({ start, end: counts.length - 1, len: counts.length - start });

  const minRunLength = Math.max(26, Math.floor(boxWidth * 0.015));
  const minRunStart = Math.floor(boxWidth * 0.12);
  const maxRunEnd = Math.floor(boxWidth * 0.88);
  const candidate = runs
    .filter((run) => run.len >= minRunLength && run.start >= minRunStart && run.end <= maxRunEnd)
    .sort((a, b) => b.len - a.len)[0];

  if (!candidate) {
    return bounds.minX + Math.floor(boxWidth * 0.28);
  }

  return bounds.minX + candidate.start;
}

function cropPng(png, rect) {
  const width = rect.maxX - rect.minX + 1;
  const height = rect.maxY - rect.minY + 1;
  const out = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = ((y + rect.minY) * png.width + (x + rect.minX)) * 4;
      const dstIndex = (y * width + x) * 4;
      out.data[dstIndex] = png.data[srcIndex];
      out.data[dstIndex + 1] = png.data[srcIndex + 1];
      out.data[dstIndex + 2] = png.data[srcIndex + 2];
      out.data[dstIndex + 3] = 255;
    }
  }

  return out;
}

function removeNearWhitePaths(svg, threshold = 242) {
  return svg.replace(
    /<path\b[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*\/>/g,
    (match, r, g, b) => {
      const rr = Number(r);
      const gg = Number(g);
      const bb = Number(b);
      return rr >= threshold && gg >= threshold && bb >= threshold ? "" : match;
    },
  );
}

function tracePngToSvg(png, isMark) {
  const options = {
    ltres: isMark ? 1.2 : 1.5,
    qtres: isMark ? 1.2 : 1.5,
    pathomit: isMark ? 14 : 20,
    rightangleenhance: true,
    colorsampling: 0,
    numberofcolors: 4,
    mincolorratio: 0,
    colorquantcycles: 2,
    layering: 0,
    blurradius: 1,
    blurdelta: 24,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 1,
    viewbox: true,
    desc: false,
    pal: [
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 214, g: 168, b: 72, a: 255 },
      { r: 200, g: 155, b: 60, a: 255 },
      { r: 162, g: 123, b: 51, a: 255 },
    ],
  };

  const imagedata = {
    width: png.width,
    height: png.height,
    data: new Uint8ClampedArray(png.data),
  };

  let svg = ImageTracer.imagedataToSVG(imagedata, options);
  svg = removeNearWhitePaths(svg);
  svg = svg
    .replace(/<svg\s+/, "<svg ")
    .replace(/\s+><\/svg>$/, "></svg>")
    .replace(/\s{2,}/g, " ")
    .trim();

  return svg;
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${value}\n`, "utf8");
}

function main() {
  ensureDir(PUBLIC_BRAND_DIR);
  ensureDir(SRC_BRAND_DIR);

  const sourcePng = PNG.sync.read(fs.readFileSync(SOURCE));
  const bounds = findBounds(sourcePng);
  const paddedBounds = expandRect(bounds, 10, sourcePng.width, sourcePng.height);

  const splitX = findMarkSplitX(sourcePng, bounds);
  const markBounds = expandRect(
    {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: Math.max(bounds.minX + 100, splitX - 1),
      maxY: bounds.maxY,
    },
    10,
    sourcePng.width,
    sourcePng.height,
  );

  const horizontalPng = cropPng(sourcePng, paddedBounds);
  const markPng = cropPng(sourcePng, markBounds);

  fs.writeFileSync(
    path.join(PUBLIC_BRAND_DIR, "cradle-logo-horizontal.png"),
    PNG.sync.write(horizontalPng),
  );
  fs.writeFileSync(path.join(PUBLIC_BRAND_DIR, "cradle-logo-mark.png"), PNG.sync.write(markPng));

  const horizontalSvg = tracePngToSvg(horizontalPng, false);
  const markSvg = tracePngToSvg(markPng, true);

  writeText(path.join(SRC_BRAND_DIR, "cradle-logo-horizontal.svg"), horizontalSvg);
  writeText(path.join(SRC_BRAND_DIR, "cradle-logo-mark.svg"), markSvg);

  writeText(path.join(PUBLIC_BRAND_DIR, "cradle-logo-horizontal.svg"), horizontalSvg);
  writeText(path.join(PUBLIC_BRAND_DIR, "cradle-logo-mark.svg"), markSvg);

  console.log("Generated brand assets:");
  console.log("- public/images/brand/cradle-logo-horizontal.png");
  console.log("- public/images/brand/cradle-logo-mark.png");
  console.log("- src/assets/brand/cradle-logo-horizontal.svg");
  console.log("- src/assets/brand/cradle-logo-mark.svg");
  console.log("- public/images/brand/cradle-logo-horizontal.svg");
  console.log("- public/images/brand/cradle-logo-mark.svg");
  console.log("Bounds:", paddedBounds, "Mark bounds:", markBounds, "SplitX:", splitX);
}

main();
