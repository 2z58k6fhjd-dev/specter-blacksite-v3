#!/usr/bin/env python3
"""Build lightweight PBR helper maps for the generated Douglas-fir card.

The source color image and its chroma-keyed alpha counterpart stay in the
repository.  This utility derives a subtle normal response and a high-roughness
map for the cutout card; it does not claim to add source photographic detail.
"""

from pathlib import Path
from math import sqrt

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / 'assets' / 'environment' / 'generated'
SOURCE = ASSET_ROOT / 'douglas-fir-card-v2.png'
NORMAL = ASSET_ROOT / 'douglas-fir-card-v2-normal.png'
ROUGHNESS = ASSET_ROOT / 'douglas-fir-card-v2-roughness.png'


def main() -> None:
    color = Image.open(SOURCE).convert('RGBA')
    alpha = color.getchannel('A')
    luminance = ImageOps.grayscale(color.convert('RGB')).filter(ImageFilter.GaussianBlur(0.85))
    width, height = color.size
    lum = luminance.load()
    mask = alpha.load()
    normal = Image.new('RGBA', color.size)
    roughness = Image.new('RGBA', color.size)
    normal_pixels = normal.load()
    roughness_pixels = roughness.load()

    for y in range(height):
        above = max(0, y - 1)
        below = min(height - 1, y + 1)
        for x in range(width):
            left = max(0, x - 1)
            right = min(width - 1, x + 1)
            opacity = mask[x, y]
            if opacity == 0:
                normal_pixels[x, y] = (128, 128, 255, 0)
                roughness_pixels[x, y] = (255, 255, 255, 0)
                continue
            # A restrained height response prevents foliage cards from looking
            # embossed while still catching directional light around needles.
            dx = (lum[right, y] - lum[left, y]) / 255.0
            dy = (lum[x, below] - lum[x, above]) / 255.0
            nx, ny, nz = -dx * 1.2, dy * 1.2, 1.0
            length = sqrt(nx * nx + ny * ny + nz * nz)
            nx, ny, nz = nx / length, ny / length, nz / length
            normal_pixels[x, y] = (
                round((nx * 0.5 + 0.5) * 255),
                round((ny * 0.5 + 0.5) * 255),
                round((nz * 0.5 + 0.5) * 255),
                opacity,
            )
            # Wet bark and needles stay deliberately rough; alpha keeps the
            # helper maps consistent with the source card silhouette.
            value = round(196 + (255 - lum[x, y]) * 0.21)
            roughness_pixels[x, y] = (value, value, value, opacity)

    NORMAL.parent.mkdir(parents=True, exist_ok=True)
    normal.save(NORMAL, optimize=True)
    roughness.save(ROUGHNESS, optimize=True)
    print(f'Wrote {NORMAL.relative_to(ROOT)} and {ROUGHNESS.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
