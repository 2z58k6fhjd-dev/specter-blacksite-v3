"""Build the SPECTER PBR v2 environment texture set.

The four photographic-style base-colour sources were generated specifically for
SPECTER with OpenAI's built-in image generation. Precise repeating industrial
surfaces are constructed analytically here so their height-derived normals and
packed ORM channels remain coherent.

Output convention:
  * albedo: sRGB WebP
  * normal: tangent-space OpenGL (+Y), linear WebP
  * orm: R=ambient occlusion, G=roughness, B=metalness, linear WebP

Run this script from any directory. It writes only beside this file.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
SIZE = 2048
SEED = 0x53504543  # "SPEC"


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    t = np.clip((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def srgb_luminance(rgb: np.ndarray) -> np.ndarray:
    return (
        rgb[..., 0] * 0.2126
        + rgb[..., 1] * 0.7152
        + rgb[..., 2] * 0.0722
    )


def periodicize_edges(array: np.ndarray, band: int = 128) -> np.ndarray:
    """Feather opposite edges together without introducing a centre seam."""
    result = array.astype(np.float32, copy=True)
    height, width = result.shape[:2]

    for offset in range(band):
        t = offset / max(1, band - 1)
        keep = t * t * (3.0 - 2.0 * t)
        left = result[:, offset].copy()
        right = result[:, width - 1 - offset].copy()
        shared = (left + right) * 0.5
        result[:, offset] = shared * (1.0 - keep) + left * keep
        result[:, width - 1 - offset] = shared * (1.0 - keep) + right * keep

    for offset in range(band):
        t = offset / max(1, band - 1)
        keep = t * t * (3.0 - 2.0 * t)
        top = result[offset].copy()
        bottom = result[height - 1 - offset].copy()
        shared = (top + bottom) * 0.5
        result[offset] = shared * (1.0 - keep) + top * keep
        result[height - 1 - offset] = shared * (1.0 - keep) + bottom * keep

    return result


def periodic_noise(size: int, cells: int, seed: int) -> np.ndarray:
    """Create deterministic bicubic value noise with wrapped control points."""
    rng = np.random.default_rng(seed)
    core = rng.random((cells, cells), dtype=np.float32)
    wrapped = np.empty((cells + 1, cells + 1), dtype=np.float32)
    wrapped[:-1, :-1] = core
    wrapped[-1, :-1] = core[0]
    wrapped[:-1, -1] = core[:, 0]
    wrapped[-1, -1] = core[0, 0]
    image = Image.fromarray(wrapped, mode="F").resize(
        (size + 1, size + 1), Image.Resampling.BICUBIC
    )
    return np.asarray(image, dtype=np.float32)[:-1, :-1]


def fbm(size: int, seed: int) -> np.ndarray:
    field = np.zeros((size, size), dtype=np.float32)
    total = 0.0
    for index, (cells, weight) in enumerate(
        ((8, 0.48), (19, 0.27), (47, 0.15), (113, 0.07), (241, 0.03))
    ):
        field += periodic_noise(size, cells, seed + index * 971) * weight
        total += weight
    field /= total
    low, high = np.percentile(field, (1.0, 99.0))
    return np.clip((field - low) / max(1e-6, high - low), 0.0, 1.0)


def blur_scalar(array: np.ndarray, radius: float) -> np.ndarray:
    pixels = np.clip(np.rint(array * 255.0), 0, 255).astype(np.uint8)
    image = Image.fromarray(pixels, mode="L")
    return np.asarray(
        image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32
    ) / 255.0


def normal_from_height(height: np.ndarray, strength: float) -> np.ndarray:
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = dy * strength
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / length, ny / length, nz / length), axis=-1)
    return np.clip(normal * 0.5 + 0.5, 0.0, 1.0)


def save_webp(array: np.ndarray, path: Path, *, kind: str) -> None:
    pixels = np.clip(np.rint(array * 255.0), 0, 255).astype(np.uint8)
    image = Image.fromarray(pixels, mode="RGB")
    if kind == "albedo":
        image.save(path, "WEBP", quality=86, method=6)
    else:
        image.save(path, "WEBP", quality=94, method=6)


def load_generated_source(name: str) -> np.ndarray:
    image = Image.open(SOURCES / name).convert("RGB")
    image = ImageOps.fit(
        image,
        (SIZE, SIZE),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    return periodicize_edges(np.asarray(image, dtype=np.float32) / 255.0, 144)


def inferred_surface(
    key: str,
    source: str,
    *,
    normal_strength: float,
    roughness_base: float,
    roughness_range: float,
    ao_floor: float,
    height_gain: float,
) -> dict[str, np.ndarray]:
    albedo = load_generated_source(source)
    gray = srgb_luminance(albedo)
    soft = blur_scalar(gray, 7.0)
    broad = blur_scalar(gray, 30.0)
    height = 0.5 + (gray - soft) * height_gain + (soft - broad) * height_gain * 0.35
    height = np.clip(periodicize_edges(height, 144), 0.0, 1.0)
    local = np.abs(gray - blur_scalar(gray, 3.0))
    local /= max(1e-6, float(np.percentile(local, 99.0)))
    roughness = np.clip(
        roughness_base + roughness_range * (0.55 * local + 0.45 * (0.55 - gray)),
        roughness_base - roughness_range * 0.15,
        min(0.99, roughness_base + roughness_range),
    )
    concavity = height - blur_scalar(height, 18.0)
    ao = np.clip(0.96 + concavity * 1.6 + (height - 0.5) * 0.12, ao_floor, 1.0)
    orm = np.stack((ao, roughness, np.zeros_like(ao)), axis=-1)
    normal = normal_from_height(height, normal_strength)
    save_webp(albedo, ROOT / f"{key}-albedo.webp", kind="albedo")
    save_webp(normal, ROOT / f"{key}-normal.webp", kind="data")
    save_webp(orm, ROOT / f"{key}-orm.webp", kind="data")
    return {"albedo": albedo, "normal": normal, "orm": orm}


def build_diamond_plate() -> dict[str, np.ndarray]:
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    tile = 256.0
    raised = np.zeros((SIZE, SIZE), dtype=np.float32)
    bars = (
        (64.0, 64.0, 45.0),
        (192.0, 64.0, -45.0),
        (64.0, 192.0, -45.0),
        (192.0, 192.0, 45.0),
    )
    for center_x, center_y, angle_degrees in bars:
        dx = (xx - center_x + tile * 0.5) % tile - tile * 0.5
        dy = (yy - center_y + tile * 0.5) % tile - tile * 0.5
        angle = math.radians(angle_degrees)
        u = dx * math.cos(angle) + dy * math.sin(angle)
        v = -dx * math.sin(angle) + dy * math.cos(angle)
        profile = (np.abs(u) / 48.0) ** 6 + (np.abs(v) / 10.0) ** 6
        raised = np.maximum(raised, 1.0 - smoothstep(0.55, 1.18, profile))

    grain = fbm(SIZE, SEED + 100)
    micro = periodic_noise(SIZE, 257, SEED + 101)
    height = np.clip(0.32 + raised * 0.58 + (micro - 0.5) * 0.025, 0.0, 1.0)
    base = np.array([0.205, 0.218, 0.216], dtype=np.float32)
    tone = (grain - 0.5) * 0.055 + (micro - 0.5) * 0.025
    albedo = np.clip(base + tone[..., None] + raised[..., None] * 0.055, 0.0, 1.0)
    normal = normal_from_height(height, 36.0)
    roughness = np.clip(0.62 - raised * 0.20 + (grain - 0.5) * 0.10, 0.34, 0.72)
    ao = np.clip(0.80 + height * 0.21, 0.78, 1.0)
    metalness = np.full_like(ao, 0.92)
    orm = np.stack((ao, roughness, metalness), axis=-1)
    save_webp(albedo, ROOT / "diamond-plate-albedo.webp", kind="albedo")
    save_webp(normal, ROOT / "diamond-plate-normal.webp", kind="data")
    save_webp(orm, ROOT / "diamond-plate-orm.webp", kind="data")
    return {"albedo": albedo, "normal": normal, "orm": orm}


def build_utility_panel() -> dict[str, np.ndarray]:
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    panel = 512.0
    edge_x = np.minimum(xx % panel, panel - (xx % panel))
    edge_y = np.minimum(yy % panel, panel - (yy % panel))
    seam = np.maximum(1.0 - smoothstep(3.0, 22.0, edge_x), 1.0 - smoothstep(3.0, 22.0, edge_y))
    rivet = np.zeros((SIZE, SIZE), dtype=np.float32)
    for px in (36.0, panel - 36.0):
        for py in (36.0, panel - 36.0):
            dx = (xx - px + panel * 0.5) % panel - panel * 0.5
            dy = (yy - py + panel * 0.5) % panel - panel * 0.5
            radius = np.sqrt(dx * dx + dy * dy)
            rivet = np.maximum(rivet, 1.0 - smoothstep(7.0, 16.0, radius))

    noise = fbm(SIZE, SEED + 200)
    fine = periodic_noise(SIZE, 211, SEED + 201)
    cell_tones = np.array(
        [[0.01, -0.015, 0.005, -0.008], [-0.012, 0.014, -0.004, 0.008],
         [0.006, -0.006, 0.012, -0.013], [-0.009, 0.004, -0.002, 0.011]],
        dtype=np.float32,
    )
    ids_x = (xx // panel).astype(np.int32) % 4
    ids_y = (yy // panel).astype(np.int32) % 4
    panel_tone = cell_tones[ids_y, ids_x]
    height = np.clip(0.54 - seam * 0.22 + rivet * 0.28 + (fine - 0.5) * 0.012, 0.0, 1.0)
    base = np.array([0.155, 0.168, 0.158], dtype=np.float32)
    grime = (noise - 0.5) * 0.045 + (fine - 0.5) * 0.018
    albedo = base + grime[..., None] + panel_tone[..., None] - seam[..., None] * 0.065
    bolt_colour = np.array([0.28, 0.29, 0.285], dtype=np.float32)
    albedo = albedo * (1.0 - rivet[..., None]) + bolt_colour * rivet[..., None]
    albedo = np.clip(albedo, 0.0, 1.0)
    normal = normal_from_height(height, 31.0)
    roughness = np.clip(0.64 + seam * 0.12 + (noise - 0.5) * 0.08 - rivet * 0.18, 0.38, 0.82)
    ao = np.clip(0.99 - seam * 0.22 - np.clip(rivet * (1.0 - rivet) * 0.20, 0.0, 0.12), 0.74, 1.0)
    metalness = np.clip(rivet * 0.82, 0.0, 0.82)
    orm = np.stack((ao, roughness, metalness), axis=-1)
    save_webp(albedo, ROOT / "utility-panel-albedo.webp", kind="albedo")
    save_webp(normal, ROOT / "utility-panel-normal.webp", kind="data")
    save_webp(orm, ROOT / "utility-panel-orm.webp", kind="data")
    return {"albedo": albedo, "normal": normal, "orm": orm}


def build_vehicle_paint() -> dict[str, np.ndarray]:
    broad = fbm(SIZE, SEED + 300)
    micro = periodic_noise(SIZE, 193, SEED + 301)
    base = np.array([0.105, 0.125, 0.112], dtype=np.float32)
    tone = (broad - 0.5) * 0.026 + (micro - 0.5) * 0.008
    albedo = np.clip(base + tone[..., None], 0.0, 1.0)
    ao = np.ones((SIZE, SIZE), dtype=np.float32)
    roughness = np.clip(0.38 + (broad - 0.5) * 0.08 + (micro - 0.5) * 0.025, 0.32, 0.46)
    metalness = np.zeros_like(ao)
    orm = np.stack((ao, roughness, metalness), axis=-1)
    save_webp(albedo, ROOT / "vehicle-paint-albedo.webp", kind="albedo")
    save_webp(orm, ROOT / "vehicle-paint-orm.webp", kind="data")
    return {"albedo": albedo, "orm": orm}


def build_vehicle_rubber() -> dict[str, np.ndarray]:
    broad = fbm(SIZE, SEED + 400)
    micro = periodic_noise(SIZE, 241, SEED + 401)
    fine = periodic_noise(SIZE, 389, SEED + 402)
    height = np.clip(0.5 + (micro - 0.5) * 0.20 + (fine - 0.5) * 0.08, 0.0, 1.0)
    base = np.array([0.065, 0.068, 0.066], dtype=np.float32)
    tone = (broad - 0.5) * 0.025 + (micro - 0.5) * 0.020
    albedo = np.clip(base + tone[..., None], 0.0, 1.0)
    normal = normal_from_height(height, 18.0)
    roughness = np.clip(0.84 + (broad - 0.5) * 0.09 + (fine - 0.5) * 0.04, 0.74, 0.94)
    ao = np.clip(0.96 + (height - blur_scalar(height, 10.0)) * 0.25, 0.88, 1.0)
    metalness = np.zeros_like(ao)
    orm = np.stack((ao, roughness, metalness), axis=-1)
    save_webp(albedo, ROOT / "vehicle-rubber-albedo.webp", kind="albedo")
    save_webp(normal, ROOT / "vehicle-rubber-normal.webp", kind="data")
    save_webp(orm, ROOT / "vehicle-rubber-orm.webp", kind="data")
    return {"albedo": albedo, "normal": normal, "orm": orm}


def open_output(key: str, channel: str) -> Image.Image:
    return Image.open(ROOT / f"{key}-{channel}.webp").convert("RGB")


def build_contact_sheet(keys: list[str]) -> None:
    font = ImageFont.load_default(size=24)
    columns = 4
    block_w, block_h = 480, 610
    sheet = Image.new("RGB", (columns * block_w, 2 * block_h), (18, 20, 22))
    draw = ImageDraw.Draw(sheet)
    for index, key in enumerate(keys):
        x0 = (index % columns) * block_w
        y0 = (index // columns) * block_h
        draw.text((x0 + 18, y0 + 14), key.upper(), fill=(235, 238, 238), font=font)
        albedo = ImageOps.fit(open_output(key, "albedo"), (440, 440), method=Image.Resampling.LANCZOS)
        sheet.paste(albedo, (x0 + 20, y0 + 52))
        normal_path = ROOT / f"{key}-normal.webp"
        if normal_path.exists():
            normal = ImageOps.fit(Image.open(normal_path).convert("RGB"), (210, 92), method=Image.Resampling.LANCZOS)
            sheet.paste(normal, (x0 + 20, y0 + 510))
            draw.text((x0 + 24, y0 + 573), "NORMAL", fill=(225, 225, 230), font=font)
        else:
            draw.rectangle((x0 + 20, y0 + 510, x0 + 230, y0 + 602), fill=(128, 128, 255))
            draw.text((x0 + 31, y0 + 540), "NO NORMAL", fill=(20, 20, 28), font=font)
        orm = ImageOps.fit(open_output(key, "orm"), (210, 92), method=Image.Resampling.LANCZOS)
        sheet.paste(orm, (x0 + 250, y0 + 510))
        draw.text((x0 + 255, y0 + 573), "ORM", fill=(225, 225, 230), font=font)
    sheet.save(ROOT / "pbr-v2-contact-sheet.webp", "WEBP", quality=88, method=6)


def build_tiling_preview(keys: list[str]) -> None:
    font = ImageFont.load_default(size=23)
    columns = 4
    block = 512
    sheet = Image.new("RGB", (columns * block, 2 * block), (15, 16, 18))
    for index, key in enumerate(keys):
        thumb = open_output(key, "albedo").resize((170, 170), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (510, 510))
        for row in range(3):
            for column in range(3):
                tile.paste(thumb, (column * 170, row * 170))
        overlay = Image.new("RGBA", tile.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        draw.rectangle((0, 0, 510, 40), fill=(0, 0, 0, 180))
        draw.text((12, 8), f"{key.upper()}  |  3 x 3 TILE QA", fill=(245, 245, 245, 255), font=font)
        tile = Image.alpha_composite(tile.convert("RGBA"), overlay).convert("RGB")
        x0 = (index % columns) * block + 1
        y0 = (index // columns) * block + 1
        sheet.paste(tile, (x0, y0))
    sheet.save(ROOT / "pbr-v2-tiling-preview.webp", "WEBP", quality=88, method=6)


def main() -> None:
    products: dict[str, dict[str, np.ndarray]] = {}
    products["concrete"] = inferred_surface(
        "concrete",
        "concrete-source-imagegen.png",
        normal_strength=24.0,
        roughness_base=0.76,
        roughness_range=0.16,
        ao_floor=0.84,
        height_gain=1.75,
    )
    products["painted-metal"] = inferred_surface(
        "painted-metal",
        "painted-metal-source-imagegen.png",
        normal_strength=12.0,
        roughness_base=0.58,
        roughness_range=0.15,
        ao_floor=0.90,
        height_gain=0.85,
    )
    products["diamond-plate"] = build_diamond_plate()
    products["asphalt"] = inferred_surface(
        "asphalt",
        "asphalt-source-imagegen.png",
        normal_strength=32.0,
        roughness_base=0.82,
        roughness_range=0.14,
        ao_floor=0.78,
        height_gain=2.15,
    )
    products["utility-panel"] = build_utility_panel()
    products["vehicle-paint"] = build_vehicle_paint()
    products["vehicle-rubber"] = build_vehicle_rubber()
    products["grass-soil"] = inferred_surface(
        "grass-soil",
        "grass-soil-source-imagegen.png",
        normal_strength=29.0,
        roughness_base=0.80,
        roughness_range=0.17,
        ao_floor=0.78,
        height_gain=1.90,
    )
    keys = list(products)
    build_contact_sheet(keys)
    build_tiling_preview(keys)


if __name__ == "__main__":
    main()
