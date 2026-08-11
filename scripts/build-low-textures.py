#!/usr/bin/env python3
"""Build reproducible 512px browser textures for SPECTER's low-payload mode.

The source models and project-generated PBR maps remain untouched.  This script
creates a parallel `assets/low-textures/` tree with the same relative texture
paths, allowing GLTFLoader's URL modifier to choose low-resolution images before
the high-resolution source is decoded on Intel/Low startup paths.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "low-textures"
MAX_DIMENSION = 512
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

TEXTURE_DIRECTORIES = [
    ASSETS / "ar15" / "textures",
    ASSETS / "m9" / "textures",
    ASSETS / "soldier" / "textures",
    ASSETS / "environment" / "polyhaven-concrete-road-barrier-02" / "textures",
    ASSETS / "environment" / "polyhaven-plastic-container" / "textures",
    ASSETS / "environment" / "polyhaven-power-box-01" / "textures",
    ASSETS / "environment" / "polyhaven-steel-frame-shelves-01" / "textures",
]
PBR_DIRECTORY = ASSETS / "environment" / "pbr-v2"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_files() -> list[Path]:
    files: list[Path] = []
    for directory in TEXTURE_DIRECTORIES:
        files.extend(path for path in directory.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES)
    # The PBR source/preview records are intentionally excluded. Only runtime
    # material maps immediately inside pbr-v2 participate in low-payload
    # rendering; contact-sheet and tiling QA images are not game textures.
    files.extend(
        path for path in PBR_DIRECTORY.iterdir()
        if path.is_file()
        and path.suffix.lower() in IMAGE_SUFFIXES
        and not path.name.startswith("pbr-v2-")
    )
    return sorted(set(files), key=lambda path: path.as_posix())


def output_mode(image: Image.Image, suffix: str) -> str:
    has_alpha = "A" in image.getbands() or image.mode == "P" and "transparency" in image.info
    if suffix == ".jpg" or suffix == ".jpeg":
        return "RGB"
    return "RGBA" if has_alpha else "RGB"


def save_resized(source: Path, target: Path) -> dict[str, object]:
    with Image.open(source) as opened:
        opened.load()
        source_size = list(opened.size)
        scale = min(1.0, MAX_DIMENSION / max(opened.width, opened.height))
        size = (max(1, round(opened.width * scale)), max(1, round(opened.height * scale)))
        image = opened.convert(output_mode(opened, source.suffix.lower()))
        if image.size != size:
            image = image.resize(size, Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        suffix = target.suffix.lower()
        if suffix == ".webp":
            image.save(target, "WEBP", quality=88, method=6)
        elif suffix == ".png":
            image.save(target, "PNG", optimize=True)
        else:
            image.save(target, "JPEG", quality=90, optimize=True, progressive=True)
    return {"sourceDimensions": source_size, "dimensions": list(size)}


def main() -> None:
    records = []
    generated_targets: set[Path] = set()
    for source in source_files():
        relative = source.relative_to(ASSETS)
        target = OUTPUT / relative
        generated_targets.add(target)
        dimensions = save_resized(source, target)
        records.append({
            "source": f"assets/{relative.as_posix()}",
            "file": f"assets/low-textures/{relative.as_posix()}",
            "sourceBytes": source.stat().st_size,
            "bytes": target.stat().st_size,
            "sourceSha256": sha256(source),
            "sha256": sha256(target),
            **dimensions,
        })

    # This directory is wholly generated. Remove stale derivatives when the
    # curated source set changes so a release never carries orphaned QA images.
    for existing in OUTPUT.rglob("*"):
        if existing.is_file() and existing.suffix.lower() in IMAGE_SUFFIXES and existing not in generated_targets:
            existing.unlink()

    runtime_bytes = sum(record["bytes"] for record in records)
    manifest = {
        "schemaVersion": 1,
        "assetSet": "SPECTER low-payload texture tier",
        "generatedBy": "scripts/build-low-textures.py",
        "maxDimension": MAX_DIMENSION,
        "runtimeBytes": runtime_bytes,
        "runtimeMiB": round(runtime_bytes / (1024 * 1024), 2),
        "records": records,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "README.md").write_text(
        "# SPECTER low-payload texture tier\n\n"
        "This tree is a reproducible 512px-max derivative of bundled runtime textures. "
        "It is generated by `scripts/build-low-textures.py` and selected before "
        "high-resolution image decode on Competitive Low / Low-texture startup paths. "
        "All source licenses and attribution obligations remain with the original "
        "asset folders; `manifest.json` records source and derivative hashes.\n",
        encoding="utf-8",
    )
    print(f"Built {len(records)} low-payload textures ({runtime_bytes / (1024 * 1024):.2f} MiB).")


if __name__ == "__main__":
    main()
