# SPECTER: Blacksite — Enemy & Environment Pass

Build: `4.2.0-ENEMY-ENVIRONMENT`

This complete GitHub Pages package includes:

- Damped first-person movement, sprinting, ADS, bob, and weapon sway
- Geometry-aligned muzzle flashes for the HK416 and tan M9
- Procedural HK416 and M9 recoil with smooth recovery
- Tan M9 slide cycling, empty-magazine lock, and reload release
- Distinct rifle and pistol casing ejection with bounce, spin, cleanup, and a 40-casing performance cap
- Procedurally animated enemy aiming, walking, hit reactions, recoil, and falling
- Lightweight enemy rifles with visible muzzle flashes, casing ejection, line-of-sight checks, and return fire
- Heavy-enemy armor plates and higher durability
- Original seamless concrete, diamond-plate floor, and utility-panel textures optimized for the browser
- More realistic facility doors, signs, vents, pipes, structural supports, trim, fixtures, and balanced lighting
- Loading percentage and diagnostics for every model package plus the environment textures
- Flashlight, facility power switch, firing, reload, and fire modes
- Original AR-15, M9, and soldier model packages, textures, and license files

## GitHub Pages replacement

1. Keep a backup of the current repository.
2. Extract every release part into the same empty folder, allowing folders to merge.
3. Upload the reconstructed folder contents to the repository root.
4. Confirm GitHub Pages publishes from `main` and `/(root)`.
5. Open the game with `?v=420` and confirm the upper-left label reads
   `BUILD 4.2.0-ENEMY-ENVIRONMENT`.

## Controls

- WASD: Move
- Mouse: Look
- Left click: Fire
- Hold right click: ADS/scope
- Shift: Sprint
- E: Use power switch
- F: Flashlight
- R: Reload
- B: Toggle rifle SEMI/AUTO
- 1: HK416
- 2: Tan M9

## Asset licensing

The original source license files remain alongside each unmodified model:

- `assets/ar15/license.txt`
- `assets/m9/license.txt`
- `assets/soldier/license.txt`

The three environment textures were created specifically for this project with
OpenAI image generation and are documented in `assets/environment/README.txt`.
