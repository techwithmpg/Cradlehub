#!/usr/bin/env python3
"""Import generated service PNGs into the public WebP service image folder."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "src" / "data" / "service-images.json"
DEFAULT_OUTPUT_DIR = ROOT / "public" / "images" / "services"
DEFAULT_ARTIFACT_DIR = ROOT / "docs" / "service-images" / "artifacts"
TARGET_SIZE = (1200, 800)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Map generated PNGs to a service image manifest batch, resize them to "
            "1200x800, and save WebP files under public/images/services."
        )
    )
    parser.add_argument("--source-dir", required=True, type=Path, help="Folder containing generated PNGs.")
    parser.add_argument("--batch", required=True, type=int, help="Manifest batch number to import.")
    parser.add_argument("--manifest", default=DEFAULT_MANIFEST, type=Path, help="Service image manifest JSON.")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, type=Path, help="Public service image folder.")
    parser.add_argument(
        "--contact-sheet",
        default=None,
        type=Path,
        help="Optional contact sheet output path. Defaults to docs/service-images/artifacts/batch-XX-contact-sheet.jpg.",
    )
    parser.add_argument("--quality", default=88, type=int, help="WebP quality from 1 to 100.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing WebP files.")
    parser.add_argument(
        "--latest",
        action="store_true",
        help="Use the newest PNG files instead of the earliest ones in the source folder.",
    )
    parser.add_argument(
        "--sort",
        choices=("mtime", "name"),
        default="mtime",
        help="How to order source files before mapping them to manifest services.",
    )
    return parser.parse_args()


def load_batch(manifest_path: Path, batch: int) -> list[dict[str, str]]:
    services = json.loads(manifest_path.read_text(encoding="utf-8"))
    batch_services = [service for service in services if service["batch"] == batch]
    if not batch_services:
        raise SystemExit(f"No services found for batch {batch} in {manifest_path}.")
    return batch_services


def get_sources(source_dir: Path, expected_count: int, latest: bool, sort_mode: str) -> list[Path]:
    sources = sorted(
        [
            *source_dir.glob("*.png"),
            *source_dir.glob("*.jpg"),
            *source_dir.glob("*.jpeg"),
            *source_dir.glob("*.webp"),
        ],
        key=lambda path: path.name.lower() if sort_mode == "name" else path.stat().st_mtime,
    )
    if len(sources) < expected_count:
        raise SystemExit(
            f"Found {len(sources)} source image files in {source_dir}, but this batch needs {expected_count}."
        )
    if len(sources) > expected_count:
        slice_name = "newest" if latest else "earliest"
        print(
            f"Found {len(sources)} source image files; using the {slice_name} {expected_count} by modified time.",
            file=sys.stderr,
        )
    selected = sources[-expected_count:] if latest else sources[:expected_count]
    return sorted(
        selected,
        key=lambda path: path.name.lower() if sort_mode == "name" else path.stat().st_mtime,
    )


def convert_image(source: Path, destination: Path, quality: int, overwrite: bool) -> Image.Image:
    if destination.exists() and not overwrite:
        raise SystemExit(f"{destination} already exists. Pass --overwrite to replace it.")

    with Image.open(source) as image:
        image = image.convert("RGB")
        image = ImageOps.fit(image, TARGET_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=quality, method=6)
        return image.copy()


def make_contact_sheet(images: list[tuple[Image.Image, str]], output_path: Path) -> None:
    columns = min(5, len(images))
    rows = math.ceil(len(images) / columns)
    thumb_size = (300, 200)
    label_height = 46
    padding = 12
    sheet_size = (
        columns * thumb_size[0] + (columns + 1) * padding,
        rows * (thumb_size[1] + label_height) + (rows + 1) * padding,
    )
    sheet = Image.new("RGB", sheet_size, (244, 239, 229))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, (image, label) in enumerate(images):
        col = index % columns
        row = index // columns
        x = padding + col * (thumb_size[0] + padding)
        y = padding + row * (thumb_size[1] + label_height + padding)
        thumbnail = ImageOps.fit(image, thumb_size, method=Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, (x, y))
        draw.text((x, y + thumb_size[1] + 8), label[:48], fill=(52, 45, 37), font=font)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "JPEG", quality=90)


def main() -> int:
    args = parse_args()
    services = load_batch(args.manifest, args.batch)
    sources = get_sources(args.source_dir, len(services), args.latest, args.sort)
    output_dir = args.output_dir
    contact_sheet = args.contact_sheet or DEFAULT_ARTIFACT_DIR / f"batch-{args.batch:02d}-contact-sheet.jpg"

    contact_images: list[tuple[Image.Image, str]] = []
    for service, source in zip(services, sources, strict=True):
        destination = output_dir / service["filename"]
        image = convert_image(source, destination, args.quality, args.overwrite)
        contact_images.append((image, service["filename"]))
        print(f"{source.name} -> {destination}")

    make_contact_sheet(contact_images, contact_sheet)
    print(f"Contact sheet: {contact_sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
