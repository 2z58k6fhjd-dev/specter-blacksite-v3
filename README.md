# SPECTER v2.4.1 — Model Loader Hotfix

This hotfix corrects a JavaScript initialization error in `prepareModel()` that prevented every licensed glTF model from being installed and left the procedural fallback models visible.

# SPECTER: Blacksite v2.4 — Licensed 3D Model Integration

This update integrates real glTF models for the first-person AR-15, Beretta M9, and VOLK/Russian soldier enemies.

## Highlights
- Real PBR weapon and enemy models
- Weapon textures reduced to 1K for browser and GTX 1050/phone friendliness
- Procedural fallback models remain available if a model fails to load
- Imported-enemy hit detection supports body and headshot damage
- Runtime caching for large model files avoids service-worker installation failures
- Required attribution is included in `CREDITS.md` and each model folder

## Important license limitation
The AR-15 model is **CC BY-NC 4.0**. This build must remain non-commercial unless that asset is replaced or separate permission is obtained.

## Installation
Replace the old repository contents with everything inside this folder. Keep the entire `assets` directory intact. After GitHub Pages deploys, hard-refresh once. The menu should show `BUILD 2.4-LICENSED-MODELS`.

## Controls
WASD move, Shift sprint, mouse look, hold left click fire, right click aim, E interact, F flashlight, R reload, 1 rifle, 2 pistol.
