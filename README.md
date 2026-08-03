# SPECTER: Blacksite v3.0.1 — Full Refresh

This is a complete replacement for the browser game's code and support files.

## Model assets

The Sketchfab models are not duplicated in this ZIP because they are large and have their own licenses. Keep or copy your existing model folders into:

```text
assets/ar15/
assets/m9/
assets/soldier/
```

Each folder must include its original `scene.gltf`, `scene.bin`, `textures/`, and license file.

## Recommended installation

1. Back up the current repository.
2. Delete or overwrite all old code files in the repository root.
3. Upload everything from this ZIP.
4. Restore the three model folders listed above.
5. In GitHub Pages, publish from `main` and `/(root)`.
6. Open the game using a cache-busting URL such as:

```text
https://2z58k6fhjd-dev.github.io/specter-blacksite-v3/?v=301
```

The build label must show:

```text
BUILD 3.0.1-FULL-REFRESH
```

## Included systems

- Clean modular source structure
- Correct world-relative WASD movement
- Imported AR-15, M9, and soldier models
- Visible asset-loading diagnostics
- Hip, ADS, and sprint weapon poses
- Rifle SEMI/AUTO selection on B
- Weapon switching on 1 and 2
- Reloading
- Muzzle flash and bullet impacts
- Basic enemy movement and damage
- Power switch and facility lighting
- Flashlight
- Service-worker cache refresh
- GTX 1050-friendly render settings

This is the new clean baseline for continued development.
