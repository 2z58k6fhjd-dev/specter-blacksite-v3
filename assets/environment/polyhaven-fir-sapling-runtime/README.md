# Poly Haven Fir Sapling - bounded runtime derivative

This folder contains the high-tier, close-range fir sapling layer used by
SPECTER's non-explorable Pacific Northwest perimeter forest.

## Source and license

- Asset: [Fir Sapling](https://polyhaven.com/a/fir_sapling)
- Official manifest: <https://api.polyhaven.com/files/fir_sapling>
- License: [CC0 1.0](https://polyhaven.com/license)
- Authors: Rico Cilliers (modeling) and Rob Tuytel (photography)

The official 1K glTF source contains three saplings and about 433,000
triangles. It is deliberately not loaded by the game as a raw source asset.
`manifest.json` preserves the official input MD5 values, exact output SHA-256
values, and the conversion details.

## Runtime budget and LODs

Only one source variation (`fir_sapling_a`) is retained. Six sparse clones are
installed just outside the fence and around the extraction gate only for
High, Ultra, and Extreme vegetation with a non-Low texture tier:

| Tier | Representation | Distance |
| --- | --- | --- |
| LOD0 | 1K PBR glTF, 157,402 triangles | 0-42 m |
| LOD1 | deterministic reduced PBR glTF, 39,760 triangles | 42-88 m |
| LOD2 | shared project PBR crossed-card impostor | 88-150 m |

The existing instanced procedural/card forest retains responsibility for the
distant dense canopy. The hero saplings are non-colliding, lazy-loaded after
core mission assets, not service-worker precached, and never requested by
Competitive Low/Intel mode.

## Rebuilding

Download the exact official 1K glTF closure into a temporary source directory,
then run:

```text
node scripts/build-fir-sapling-runtime.mjs --source <folder> --out assets/environment/polyhaven-fir-sapling-runtime
```

The builder refuses bad MD5 inputs or a non-empty output directory. It emits
both glTF derivatives, their shared 1K PBR image set, and `manifest.json`.
