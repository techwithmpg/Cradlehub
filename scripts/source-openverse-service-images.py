#!/usr/bin/env python3
"""Source reusable service images from Openverse and save them as local WebP files."""

from __future__ import annotations

import argparse
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "src" / "data" / "service-images.json"
ATTRIBUTIONS_PATH = ROOT / "src" / "data" / "service-image-attributions.json"
OUTPUT_DIR = ROOT / "public" / "images" / "services"
ARTIFACT_DIR = ROOT / "docs" / "service-images" / "artifacts"
TARGET_SIZE = (1200, 800)
OPENVERSE_URL = "https://api.openverse.org/v1/images/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
ALLOWED_LICENSES = ("cc0", "pdm", "by")
BLOCKED_WORDS = (
    "car",
    "automotive",
    "theatre",
    "theater",
    "concert",
    "restaurant",
    "food",
    "surgery",
    "medical",
    "blood",
    "nude",
    "naked",
    "sexy",
    "erotic",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Search Openverse for reusable images, crop/resize them to 1200x800, "
            "and save them using service manifest filenames."
        )
    )
    parser.add_argument("--batch", type=int, action="append", help="Batch number to source. Repeatable.")
    parser.add_argument("--start-batch", type=int, help="First batch number to source.")
    parser.add_argument("--end-batch", type=int, help="Last batch number to source.")
    parser.add_argument("--manifest", default=MANIFEST_PATH, type=Path)
    parser.add_argument("--output-dir", default=OUTPUT_DIR, type=Path)
    parser.add_argument("--attributions", default=ATTRIBUTIONS_PATH, type=Path)
    parser.add_argument("--licenses", default="cc0,pdm,by", help="Openverse licenses to try, in order.")
    parser.add_argument("--page-size", default=40, type=int)
    parser.add_argument("--quality", default=88, type=int)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--delay", default=0.25, type=float, help="Polite delay between Openverse requests.")
    return parser.parse_args()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def selected_batches(args: argparse.Namespace) -> set[int]:
    batches = set(args.batch or [])
    if args.start_batch is not None or args.end_batch is not None:
        start = args.start_batch if args.start_batch is not None else args.end_batch
        end = args.end_batch if args.end_batch is not None else args.start_batch
        if start is None or end is None:
            raise SystemExit("Provide both --start-batch and --end-batch, or use --batch.")
        batches.update(range(min(start, end), max(start, end) + 1))
    if not batches:
        raise SystemExit("No batches selected. Use --batch or --start-batch/--end-batch.")
    return batches


def compact_name(name: str) -> str:
    lower = name.lower()
    replacements = {
        " w/ ": " with ",
        "+": " plus ",
        "&": " and ",
        "/": " ",
        " or ": " ",
        " 60min": "",
        " 90min": "",
    }
    for old, new in replacements.items():
        lower = lower.replace(old, new)
    return " ".join(lower.split())


def query_plan(service: dict[str, Any]) -> list[str]:
    name = compact_name(service["name"])
    category = service["category"].lower()
    queries: list[str] = []

    if any(word in name for word in ("manicure", "pedicure", "mani-pedi", "foot spell")):
        queries += ["spa manicure pedicure hands", "premium nail spa treatment"]
    elif "eyelash" in name:
        queries += ["eyelash extension beauty spa", "lash beauty treatment spa"]
    elif "eyebrow" in name or "threading" in name:
        queries += ["eyebrow threading beauty spa", "brow treatment spa"]
    elif "make up" in name or "makeup" in name:
        queries += ["makeup beauty salon spa", "professional makeup salon"]
    elif "hair" in name or "shampoo" in name or "keratin" in name or "ombre" in name:
        queries += ["premium hair salon treatment", "hair spa salon treatment"]
    elif "waxing" in name:
        queries += ["spa waxing treatment room", "beauty spa treatment room towels"]
    elif "laser" in name or "pico" in name or "tattoo" in name:
        queries += ["skincare laser facial spa", "beauty skincare treatment room"]
    elif "facial" in name or "skin" in name or "dermabrasion" in name or "oxy" in name or "pdt" in name:
        queries += ["premium facial spa treatment", "skincare facial spa"]
    elif "body scrub" in name or "scrub" in name or "wrap" in name:
        queries += ["spa body scrub treatment", "body scrub spa towels oils"]
    elif "party" in category or "package" in category or "couples" in name or "besties" in name:
        queries += ["luxury spa group relaxation", "couples spa room massage"]
    elif "thai" in name:
        queries += ["thai massage spa room", "thai wellness spa mat"]
    elif "shiatsu" in name:
        queries += ["shiatsu massage spa", "pressure point massage spa"]
    elif "ventosa" in name or "moxa" in name:
        queries += ["cupping therapy spa room", "wellness cupping spa"]
    elif "stone" in name:
        queries += ["hot stone massage spa", "spa stones massage"]
    else:
        queries += [f"{name} spa", f"{name} wellness"]

    if "massage" in category or "massage" in name:
        queries += ["spa massage room", "premium massage spa"]
    elif "salon" in category:
        queries += ["premium salon spa", "beauty salon spa"]
    elif "skin" in category:
        queries += ["skincare spa treatment", "facial spa treatment"]
    else:
        queries += ["premium spa wellness", "spa treatment room"]

    deduped: list[str] = []
    for query in queries:
        if query not in deduped:
            deduped.append(query)
    return deduped


def openverse_search(query: str, license_name: str, page_size: int) -> list[dict[str, Any]]:
    params = {
        "format": "json",
        "q": query,
        "license": license_name,
        "aspect_ratio": "wide",
        "mature": "false",
        "page_size": str(page_size),
    }
    url = f"{OPENVERSE_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("results", [])


def combined_text(result: dict[str, Any]) -> str:
    pieces = [
        str(result.get("title") or ""),
        str(result.get("url") or ""),
        str(result.get("foreign_landing_url") or ""),
    ]
    tags = result.get("tags")
    if isinstance(tags, list):
        pieces.extend(str(tag.get("name") or "") for tag in tags if isinstance(tag, dict))
    return " ".join(pieces).lower()


def is_usable_candidate(result: dict[str, Any], used_urls: set[str], used_ids: set[str]) -> bool:
    if result.get("id") in used_ids or result.get("url") in used_urls:
        return False
    if result.get("license") not in ALLOWED_LICENSES:
        return False
    if result.get("mature") is True:
        return False
    if result.get("unstable__sensitivity"):
        return False
    width = int(result.get("width") or 0)
    height = int(result.get("height") or 0)
    if width < 900 or height < 500:
        return False
    text = combined_text(result)
    return not any(word in text for word in BLOCKED_WORDS)


def download_image(url: str) -> Image.Image | None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
    except (urllib.error.URLError, TimeoutError):
        return None
    try:
        image = Image.open(BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        return None
    if image.width < 900 or image.height < 500:
        return None
    return image


def save_webp(image: Image.Image, destination: Path, quality: int) -> Image.Image:
    output = ImageOps.fit(image, TARGET_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, "WEBP", quality=quality, method=6)
    return output


def attribution_for(service: dict[str, Any], result: dict[str, Any], query: str) -> dict[str, Any]:
    license_name = result.get("license")
    license_version = result.get("license_version")
    license_label = "CC0" if license_name == "cc0" else "Public Domain Mark" if license_name == "pdm" else "CC BY"
    if license_version:
        license_label = f"{license_label} {license_version}"
    return {
        "serviceId": service["id"],
        "serviceName": service["name"],
        "filename": service["filename"],
        "imageUrl": service["imageUrl"],
        "source": "Openverse",
        "openverseId": result.get("id"),
        "title": result.get("title"),
        "creator": result.get("creator"),
        "creatorUrl": result.get("creator_url"),
        "landingUrl": result.get("foreign_landing_url"),
        "originalImageUrl": result.get("url"),
        "license": license_label,
        "licenseUrl": result.get("license_url"),
        "attribution": result.get("attribution"),
        "query": query,
        "changes": "Cropped/resized to 1200x800 and converted to WebP for CradleHub service cards.",
    }


def make_contact_sheet(rows: list[tuple[Image.Image, str]], batch: int) -> None:
    if not rows:
        return
    columns = min(5, len(rows))
    thumb_size = (300, 200)
    label_height = 46
    padding = 12
    sheet = Image.new(
        "RGB",
        (
            columns * thumb_size[0] + (columns + 1) * padding,
            math.ceil(len(rows) / columns) * (thumb_size[1] + label_height) + padding,
        ),
        (244, 239, 229),
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (image, label) in enumerate(rows):
        col = index % columns
        row = index // columns
        x = padding + col * (thumb_size[0] + padding)
        y = padding + row * (thumb_size[1] + label_height)
        thumb = ImageOps.fit(image, thumb_size, method=Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.text((x, y + thumb_size[1] + 8), label[:48], fill=(52, 45, 37), font=font)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(ARTIFACT_DIR / f"batch-{batch:02d}-openverse-contact-sheet.jpg", "JPEG", quality=90)


def source_service(
    service: dict[str, Any],
    licenses: list[str],
    page_size: int,
    used_urls: set[str],
    used_ids: set[str],
    delay: float,
) -> tuple[Image.Image, dict[str, Any]] | None:
    for query in query_plan(service):
        for license_name in licenses:
            time.sleep(delay)
            try:
                results = openverse_search(query, license_name, page_size)
            except (urllib.error.URLError, TimeoutError):
                continue
            for result in results:
                if not is_usable_candidate(result, used_urls, used_ids):
                    continue
                image = download_image(str(result["url"]))
                if image is None:
                    continue
                return image, attribution_for(service, result, query)
    return None


def main() -> int:
    args = parse_args()
    licenses = [license.strip() for license in args.licenses.split(",") if license.strip()]
    manifest = read_json(args.manifest, [])
    attributions: list[dict[str, Any]] = read_json(args.attributions, [])
    selected = selected_batches(args)
    used_urls = {entry.get("originalImageUrl") for entry in attributions if entry.get("originalImageUrl")}
    used_ids = {entry.get("openverseId") for entry in attributions if entry.get("openverseId")}
    attribution_by_filename = {entry["filename"]: entry for entry in attributions if "filename" in entry}
    rows_by_batch: dict[int, list[tuple[Image.Image, str]]] = {}
    failures: list[str] = []
    sourced = 0

    for service in manifest:
        batch = int(service["batch"])
        if batch not in selected:
            continue
        destination = args.output_dir / service["filename"]
        if destination.exists() and not args.overwrite:
            continue

        result = source_service(service, licenses, args.page_size, used_urls, used_ids, args.delay)
        if result is None:
            failures.append(service["filename"])
            continue

        image, attribution = result
        output = save_webp(image, destination, args.quality)
        used_urls.add(attribution["originalImageUrl"])
        used_ids.add(attribution["openverseId"])
        attribution_by_filename[service["filename"]] = attribution
        rows_by_batch.setdefault(batch, []).append((output, service["filename"]))
        sourced += 1
        print(f"{service['filename']} <- {attribution['title']} ({attribution['license']})")

    merged_attributions = [attribution_by_filename[key] for key in sorted(attribution_by_filename)]
    write_json(args.attributions, merged_attributions)
    for batch, rows in rows_by_batch.items():
        make_contact_sheet(rows, batch)

    print(f"Sourced {sourced} images from Openverse.")
    if failures:
        print("No suitable Openverse image found for:")
        for filename in failures:
            print(f"- {filename}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
