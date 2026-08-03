# SPECTER: Blacksite v3.0 Foundation

This package is a clean modular rebuild of the browser prototype.

## Important

The large licensed Sketchfab models are **not duplicated inside this ZIP**. Copy your existing folders into this package:

```text
assets/ar15/
assets/m9/
assets/soldier/
```

Each folder must keep its `scene.gltf`, `scene.bin`, textures, and license file together.

## Upload

For the safest test, create a new GitHub repository named:

```text
specter-blacksite-v3-clean
```

Upload everything from this package to the repository root, then copy the three existing model folders into `assets/`.

Enable GitHub Pages from `main` and `/(root)`.

## Features in this foundation

- Modular ES modules
- Imported AR-15, M9, and soldier loading
- On-screen asset diagnostics
- Correct world-relative WASD movement
- Rifle SEMI/AUTO selector on **B**
- Separate hip, ADS, and sprint poses
- Soldier foot alignment from model bounding box
- Working power switch, flashlight, enemies, shooting, and weapon switching
- GTX 1050-friendly render scale

This is a clean foundation, not yet the final content-complete game. The next iterations can add animation mixers, refined weapon transforms, audio, improved AI, reload animations, muzzle effects, and expanded levels without returning to one enormous `game.js`.
