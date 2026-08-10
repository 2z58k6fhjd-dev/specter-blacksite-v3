# SPECTER: Blacksite

Build: `5.1.7-CC0-ROAD-BARRIERS`

SPECTER: Blacksite is a desktop-first browser FPS built with Three.js. Build 5.0
overhauls the controller, viewmodels, combat presentation, enemy behavior,
facility, exterior compound, rendering, materials, audio, and mission flow while
keeping the project suitable for static hosting on GitHub Pages.

## Build 5.0 highlights

- Damped first-person movement, sprint transitions, camera motion, weapon bob,
  and mouse-driven sway.
- Pointer-lock mouse look plus an automatic embedded-browser fallback when
  pointer lock is unavailable.
- Five selectable, grounded present-day weapons: HK416, tan M9A4, C5-K compact
  carbine, R7.62 designated rifle, and MCR-300 suppressed rifle.
- Geometry-calibrated hip and ADS poses, shoulder-seated rifle stocks,
  barrel-aligned muzzle/ejection anchors, and under-barrel flashlight mounts.
- Crosshair removal during every ADS transition, aligned iron sights, and a live
  rendered magnified view through the supported rifle optic.
- Visible full-body SPECTER operator plus first-person sleeves, hands, gloves,
  and weapon grips derived from the bundled 127-joint soldier rig.
- Procedural equip, sprint, sway, reload, recoil, casing ejection, pistol-slide,
  hit, suppression, locomotion, and grounded death animation systems.
- Eight hostiles across rifleman, scout, breacher, marksman, and commander role
  variants. These roles share the bundled soldier source rig and are varied with
  materials, equipment, durability, and behavior. Their weapons are full textured
  clones of the bundled AR-15 with role-specific scaling, tints, and suppressors;
  the roles are not falsely represented as five separately downloaded character
  models.
- Role kits add distinct modern silhouettes: ballistic helmets or field caps,
  plate carriers, mag and utility pouches, battle belts, radios, assault packs,
  headsets, marksman gear, command kit, and breacher armor/visor/knee pads.
  These are project-authored additions to the bundled licensed soldier rig.
- Tactical enemy AI with patrol, sight and hearing perception, investigation,
  search, chase, engagement, cover, flanking, suppression, retreat, squad alerts,
  and per-role difficulty tuning.
- Expanded facility with furnished work areas, storage, server equipment,
  three high-detail CC0 industrial shelf props with collision/shadowing, a
  2K high-detail CC0 Power Box cabinet around the animated breaker hardware,
  six high-detail CC0 storage containers and six high-detail CC0 weathered
  concrete road barriers deployed as exterior hard cover,
  and a powered two-leaf exit.
- Compact exterior compound with a checkpoint, motor pool, storage yard,
  communications area, service roads, barriers, grounded modern vehicles, and
  an extraction pad.
- Instanced, non-explorable city skyline beyond the perimeter for atmosphere.
- Physical sky, moving cloud bank, sun and shadow lighting, fog transitions,
  ACES tone mapping, SSAO, restrained bloom, and selectable quality presets
  that apply immediately and persist between launches.
- Eight project-generated PBR v2 material families using 23 browser-ready 2K
  albedo, normal, and packed ORM maps.
- Procedural indoor/outdoor ambience, adaptive exploration/combat music,
  spatial weapon and mechanism sounds, impacts, and enemy call tones.
  CC BY 3.0 recorded SKS and CZ transient layers now reinforce rifle and pistol
  reports while the procedural system keeps spatial tails and suppression.
- Ten CC0 recorded player-footstep clips now provide varied movement foley.
  The facility applies a bright hard-floor treatment while the exterior grass
  is softer, lower-passed, and lightly rustled; each has a procedural fallback.
- Fourteen CC0 Kenney human-performed tactical callouts now replace the
  temporary synthetic enemy phrases for contact, investigation, backup,
  flanking, retreat, suppression, and downed states. Male/female variations are radio-filtered,
  spatialized, and retain a procedural fallback if a clip cannot decode.
- Loading progress and diagnostics for models, the player rig, environment maps,
  and graphics pipeline.
- Complete mission loop and victory state: restore power, clear all eight
  hostiles, then reach the extraction pad.

## Mission

1. Restore power at the animated facility breaker.
2. Leave through the powered exterior doors.
3. Clear the checkpoint and perimeter compound.
4. Reach the marked extraction pad after all hostiles are neutralized.

The final condition displays the `BLACKSITE SECURED` victory screen with mission
statistics and a redeploy option.

## Weapons

| Slot | Weapon | Role | Implementation and provenance |
| --- | --- | --- | --- |
| 1 | HK416 | 5.56 mm service rifle | Bundled textured AR-15 source, tuned as the primary viewmodel |
| 2 | Tan M9A4 | 9 mm sidearm | Bundled textured M9 source with animated slide and magazine behavior |
| 3 | C5-K Compact Carbine | Compact 5.56 mm carbine | Full bundled high-resolution AR-15 clone variant with project-authored scale, tint, handling, and anchors |
| 4 | R7.62 Designated Rifle | Semi-automatic 7.62 mm precision rifle | Full bundled high-resolution AR-15 clone variant with project-authored marksman proportions, handling, and anchors |
| 5 | MCR-300 Suppressed | Suppressed modern rifle | Full bundled high-resolution AR-15 clone variant with a project-authored suppressor, handling, and anchors |

The three additional runtime rifles preserve the complete bundled AR-15 mesh and
texture set, then apply project-authored proportions, materials, handling data,
and geometry-calibrated anchors. They are high-resolution source variants, not
separately licensed scans or manufacturer-supplied CAD. The HK416, C5-K, R7.62,
MCR-300, and all enemy weapon clones use the bundled AR-15 art and therefore
inherit its Creative Commons Attribution-NonCommercial 4.0 restriction. See
`THIRD_PARTY_ASSETS.md` before redistributing or reusing any weapon art.

`src/modern-arsenal.js` remains in the repository as an optional prototype
factory module. Its procedural T12 shotgun was not connected to the release
loadout because it failed the final close-up art-quality gate. The live game does
not import, execute, precache, or assign a runtime weapon slot to that module or
prototype.

## Controls

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Move |
| Mouse | Look |
| Left mouse | Fire |
| Hold right mouse | ADS |
| Right mouse in embedded fallback mode | Toggle ADS |
| Left `Shift` | Sprint |
| `E` | Use the power breaker |
| `F` | Toggle the weapon-mounted flashlight |
| `R` | Reload |
| `B` | Toggle SEMI/AUTO when the selected weapon supports it |
| `G` | Open/close graphics settings; choose Performance, Balanced, High, or Ultra |
| `1` | HK416 |
| `2` | Tan M9A4 |
| `3` | C5-K Compact Carbine |
| `4` | R7.62 Designated Rifle |
| `5` | MCR-300 Suppressed |

Open `player-model.html` to inspect the SPECTER operator from four directions and
export the generated player model as GLB.

## Running and deploying

The project has no compile step. Serve the repository root over HTTP; opening
`index.html` directly from the filesystem can prevent module and asset loading.
For GitHub Pages, publish `main` from `/(root)` and keep the existing directory
structure intact.

Useful rendering query parameters are:

- `?quality=performance`
- `?quality=balanced`
- `?quality=high` (default; designed around a 6 GB GPU at 1080p)
- `?quality=ultra` (8 GB GPU target)

The in-game **GRAPHICS** control on the deployment screen and the `GFX` button
during play expose the same four presets without a reload. The selected preset
is stored locally, while a valid `?quality=` query parameter intentionally takes
precedence for a one-off test session.

## Audio provenance and fallback

The runtime retains two short, normalized derivatives from the recorded
OpenGameArt **Gunshot Sounds** archive by Vincent Sevedge / Tabasco: an SKS
report for rifle fire and a CZ report for pistol fire. The archive's local
**CC BY 3.0 Unported** notice is preserved under `assets/audio/`; attribution
and that notice must stay with redistribution. Loading or decoding these layers
is optional—if they are unavailable, the procedural weapon system remains the
automatic fallback without blocking the mission.

The high-resolution runtime payload is about 220 MiB, so the first launch
requires a stable connection and can take noticeably longer on mobile networks.
The service worker installs the small application shell first, then caches the
large model and texture payload on a best-effort basis; a failed optional cache
item is recovered by the normal network-first loader on a later visit.

The `qa` query modes in `src/main.js` are intentionally restricted to
`localhost` and `127.0.0.1`; they are test helpers, not alternate public game
modes.

## Materials and performance

The runtime PBR v2 set is in `assets/environment/pbr-v2/`. It contains 23
2048 x 2048 WebP maps across concrete, painted metal, diamond plate, asphalt,
utility panel, vehicle paint, vehicle rubber, and grass/soil families. The map
convention, generation prompts, hashes, browser budget, and visual QA record are
documented in `assets/environment/pbr-v2/README.md` and `manifest.json`.

The default high preset enables soft shadows, screen-space ambient occlusion,
restrained bloom, and the final output pass while capping pixel ratio for a
desktop-browser frame budget. Use the lower presets on integrated graphics.

## Asset licensing

Read `THIRD_PARTY_ASSETS.md` before redistribution. The original license files
remain beside every bundled third-party model:

- `assets/ar15/license.txt`
- `assets/m9/license.txt`
- `assets/soldier/license.txt`

Important: the bundled AR-15 by Lokeig is licensed CC BY-NC 4.0. It requires
attribution and prohibits commercial use. Because the HK416, C5-K, R7.62, and
MCR-300 player weapons and all enemy weapon clones use that source, this build
must not be treated as commercially reusable weapon art unless the source is
replaced or separately licensed.

The SPECTER operator is a derived adaptation of the bundled soldier rig. Its
construction and attribution reminder are in `assets/player/README.txt`. The PBR
v2 materials are project-generated assets documented with their retained inputs,
prompts, and build records.

Research links in `THIRD_PARTY_ASSETS.md` are evaluation notes only. Their models,
textures, and audio are not bundled merely because a source URL is listed. No
sci-fi, futuristic, fantasy, cartoon, stylized, or visibly low-detail research
asset was accepted into the build 5.1.7 runtime.
