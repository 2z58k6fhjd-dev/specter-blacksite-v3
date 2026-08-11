# SPECTER: Blacksite

Build: `5.8.0-FIR-LOD`

SPECTER: Blacksite is a desktop-first browser FPS built with Three.js. Build
5.8.0 continues the controller, viewmodel, combat presentation, enemy behavior,
facility, exterior-compound, rendering, materials, audio, and mission-flow work
while keeping the project suitable for static hosting on GitHub Pages.

## Build 5.8.0 highlights

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
- Procedural equip, holster, inspect, sprint, jump/landing response, sway,
  reload, recoil, casing ejection, pistol-slide, hit, suppression, locomotion,
  and grounded death animation systems.
- Weapon changes now visibly stow the current viewmodel before drawing the next
  one; `I` performs a safe inspect action and Space adds a conservative jump and
  landing response without bypassing collision or combat state.
- Reload, equip, and chamber/bolt-check actions share marker timelines: magazine,
  action, and ready markers synchronize the ammo transition, slide/bolt motion,
  and sound cues. This is project-authored procedural choreography, not imported
  motion capture or a separately licensed weapon-animation pack.
- Rifle reloads now physically animate the verified inserted magazine through the
  stow, hand-off, and reseat markers; the M9 retains its separate slide, casing,
  muzzle, and ejection choreography. Unverified AR parts are deliberately not
  mislabeled as a bolt or charging handle.
- Tactical and empty reloads now use distinct marker behavior and per-weapon
  timing. The tan M9's authored magazine hierarchy moves through its own reload
  markers, and its physical slide follows a dedicated chamber-check curve.
  Inspect/equip foley now fires from action markers rather than input time.
- Defeated enemies complete a grounded death and brief settle hold before their
  carried rifle and role equipment drop. A bounded reusable prop pool prevents
  sustained combat from continually allocating new visual dressing; drops are
  not pickups, inventory, or loot.
- Twelve hostiles across rifleman, scout, breacher, marksman, and commander role
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
  recessed, wall-mounted 2K high-detail CC0 Power Box cabinet around the
  animated breaker hardware,
  six high-detail CC0 storage containers and six high-detail CC0 weathered
  concrete road barriers deployed as exterior hard cover that tactical enemies
  can select when suppressed or retreating,
  and a powered two-leaf exit.
- Expanded exterior compound with a checkpoint, motor pool, storage yard,
  communications area, utility/fuel yard, service roads, barriers, grounded
  modern vehicles, and a final extraction pad.
- A 6,800-clump instanced grass layer adds close-range depth across the PBR
  exterior terrain while keeping the vegetation to a single efficient draw call;
  it can be disabled independently for low-end hardware.
- Instanced, non-explorable Pacific Northwest perimeter forest with near, mid,
  and far LOD layers replaces the old skyline atmosphere. Its baseline layers
  sit beyond the fence, have no collision, and remain a deliberately
  texture-free procedural fallback--not a substitute for a future authored
  high-detail tree pack.
- Project-generated 2D photo-tree impostors supplement the procedural fallback
  only at **High**, **Ultra**, and **Extreme** vegetation density. The high-tier
  card layer combines the original fir silhouette with a Douglas-fir v2 card
  using its own albedo, normal, and roughness maps through shared instanced PBR
  materials. The cards have no collision and stay absent if optional textures
  are unavailable; they are not represented as full 3D, photogrammetric, or AAA
  tree geometry.
- The high-tier card layer now has a correct normal basis, PBR forest-floor UV
  density, 320 varied instanced fir cards across two shared draw calls, and
  distance-safe dithering. It remains an honest 2D impostor enhancement rather
  than a claim of full 3D scanned trees.
- A separate bounded **Fir Sapling** close-detail layer derives one 1K CC0 Poly
  Haven source variation into six sparse, non-colliding perimeter/extraction
  placements. It uses a 157,402-triangle PBR LOD0 at 0-42 m, a deterministic
  39,760-triangle PBR LOD1 at 42-88 m, and the existing shared PBR crossed-card
  LOD2 at 88-150 m. It is a sparse high-tier detail pass; the dense forest still
  relies on the procedural/card layers and is not claimed as a fully authored
  3D or AAA forest.
- The Fir Sapling layer is requested only after the core mission is playable,
  only at High, Ultra, or Extreme vegetation with a non-Low texture tier, and is
  excluded from service-worker precaching. Competitive Low/Intel does not
  request or render it.
- The raw 4K **Fern 02** CC0 source set streams only after the core mission is
  playable, when vegetation density is **High**, **Ultra**, or **Extreme** and
  the texture tier is not Low. It uses the official `fern_02_alpha_4k.png` mask
  at runtime for leaf cutouts and supplies sparse, non-colliding foreground
  clumps near the fence and extraction route. Competitive Low does not request
  or render it; its raw 4K maps are deliberately excluded from lower vegetation
  budgets. See `THIRD_PARTY_ASSETS.md` for source and credit details.
- AUTO chooses a conservative graphics starting point from browser-reported
  capabilities, including an Intel/Competitive Low fallback for generic
  capability-constrained or very-slow devices even when the renderer name does
  not identify Intel. It then runs after entering the loaded mission (45 warm-up
  frames followed by 120 unclamped gameplay samples). It is an estimate rather
  than a precise VRAM test; players can choose Competitive Low, Performance,
  Balanced, High, Ultra, or Extreme instead.
- Competitive Low / Intel HD 4600 uses a direct-render path that disables
  shadows, post-processing, ground grass, and dense foliage. On a fresh
  Competitive Low or Low-texture launch it selects a checked 68-file,
  **512px-max / 9.84 MiB** texture derivative set before the original 2K/4K
  model and PBR images decode, so weapons and world materials remain textured
  instead of being replaced by blank stand-ins. It is a clarity/performance
  mode, not a high-detail texture setting.
- Custom graphics controls independently set render scale, texture tier,
  shadows, vegetation, grass, fog, ambient occlusion, reflections, and bloom,
  and display an active-resource GPU-memory estimate that refreshes on setting
  changes and browser resizing.
- Extreme probes for a complete, manifest-verified native 4K environment pack
  on startup or after switching into Extreme. This release does not bundle that
  pack, so it accurately reports a 2K PBR fallback rather than upscaling or
  labeling a partial pack as native 4K.
- The Codex/ChatGPT embedded preview has a restricted WebGL compositor, so a
  requested Extreme tier safely reports and applies High there rather than
  attempting unsupported SSR. Standalone browsers keep the full Extreme preset.
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
  spatialized, paired with role/callsign subtitles, and retain a procedural
  fallback if a clip cannot decode. The persistent **Voice Volume** slider
  affects enemy voice/radio playback separately from effects and music.
- Loading progress and diagnostics for models, the player rig, environment maps,
  and graphics pipeline.
- Complete mission loop and victory state: restore power, clear all twelve
  hostiles, reach the extraction pad, pass through the opening forest gate, and
  survive the short pursuit/exfiltration handoff.

## Mission

1. Restore power at the recessed, wall-mounted facility breaker.
2. Leave through the powered exterior doors.
3. Clear the checkpoint and perimeter compound.
4. Reach the marked extraction pad after all hostiles are neutralized.
5. The forest gate opens and carries SPECTER into a brief pursuit/exfiltration
   sequence before the victory handoff.

The final condition displays the `BLACKSITE SECURED` victory screen with mission
statistics and a redeploy option. The gate run is a controlled audiovisual end
beat: pursuit shots and radio calls are present for atmosphere, but do not damage
the player or create an additional combat encounter.

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
| `C` | Chamber/bolt check (action animation) |
| `I` | Inspect the equipped weapon |
| `Space` | Jump (grounded; collision-safe) |
| `B` | Toggle SEMI/AUTO when the selected weapon supports it |
| `G` | Open/close graphics settings; use AUTO, a manual profile, or custom controls |
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

- `?quality=auto` (first-run default; quick benchmark + safe headroom)
- `?quality=intel` (Competitive Low)
- `?quality=performance`
- `?quality=balanced`
- `?quality=high` (designed around a 6 GB GPU at 1080p)
- `?quality=ultra` (8 GB GPU target)
- `?quality=extreme` (10 GB target)

The in-game **GRAPHICS** control on the deployment screen and the `GFX` button
during play expose AUTO, the six manual profiles, and custom controls without a
reload. The selected preference is stored locally, while a valid `?quality=`
query parameter intentionally takes precedence for a one-off test session.

The focused local-browser acceptance record for this build is in
[`docs/QA/5.8.0-runtime-acceptance.md`](docs/QA/5.8.0-runtime-acceptance.md).
It records the exercised High forest, Competitive Low, breaker, and extraction
paths, along with the coverage limits that still need real-hardware follow-up.

## Audio provenance and fallback

The runtime retains two short, normalized derivatives from the recorded
OpenGameArt **Gunshot Sounds** archive by Vincent Sevedge / Tabasco: an SKS
report for rifle fire and a CZ report for pistol fire. The archive's local
**CC BY 3.0 Unported** notice is preserved under `assets/audio/`; attribution
and that notice must stay with redistribution. Loading or decoding these layers
is optional; if they are unavailable, the procedural weapon system remains the
automatic fallback without blocking the mission.

The release ZIP's exact byte count and SHA-256 are recorded in the generated
release manifest beside the archive. The optional high-resolution texture
payload streams after first launch, so the amount downloaded on a first visit
can vary with the selected graphics preset.
The high-resolution runtime payload requires a stable connection on first launch
and can take noticeably longer on mobile networks.
The service worker installs the small application shell first, then caches the
large model and texture payload on a best-effort basis; a failed optional cache
item is recovered by the normal network-first loader on a later visit.
Fern 02 and the bounded Fir Sapling derivatives are deliberately excluded from
service-worker precaching and remain optional, post-readiness high-vegetation
streams.

The `qa` query modes in `src/main.js` are intentionally restricted to
`localhost` and `127.0.0.1`; they are test helpers, not alternate public game
modes.

## Materials and performance

The runtime PBR v2 set is in `assets/environment/pbr-v2/`. It contains 23
2048 x 2048 WebP maps across concrete, painted metal, diamond plate, asphalt,
utility panel, vehicle paint, vehicle rubber, and grass/soil families. The map
convention, generation prompts, hashes, browser budget, and visual QA record are
documented in `assets/environment/pbr-v2/README.md` and `manifest.json`.

The default High preset enables soft shadows, screen-space ambient occlusion,
restrained bloom, and the final output pass while capping pixel ratio for a
desktop-browser frame budget. **Competitive Low (Intel HD 4600)** is the safe
starting point for older integrated graphics: it uses a 0.65 render-scale cap,
direct rendering, no dynamic shadows, 1x anisotropy, hides the exterior grass
layer, and uses the checked 512px-max low-payload derivative set for the
viewmodel, world PBR maps, set dressing, and soldier textures on a fresh Low
launch.
The **Extreme (10 GB)** tier raises the render-scale cap to 2.0, enables 4096px
sun shadows, 16x texture sampling where supported, SSAO, full-resolution SSR,
and stronger bloom.

The shipped environment pack remains 23 native 2048px WebP maps. Extreme is
**4K-ready**, not falsely labeled as a 4K environment pack: it reports a 2K PBR
fallback until a native `assets/environment/pbr-v2-4k/` asset tier is supplied.
High-resolution source textures remain in the project payload; Competitive Low
selects compact 512px derivatives before decode rather than promising the full
close-up texture treatment on constrained hardware. Texture-tier changes are
explicitly reload-bound in either direction: the game keeps currently decoded
maps visible, shows the requested reload status, and applies the real payload
tree on the next launch instead of replacing materials with blank stand-ins.

High vegetation can additionally show project-generated 2D photo-tree impostors
through shared, instanced PBR materials. The Douglas-fir v2 card uses retained
project-generated albedo, normal, and roughness maps; the cards are hidden at
Off, Low, and Medium density and use no collision. This keeps the procedural
forest as the all-tier fallback.
At High, Ultra, or Extreme vegetation with a non-Low texture tier, six sparse
CC0 Poly Haven Fir Sapling derivatives can stream after core mission readiness
for close perimeter/extraction detail. They retain one 1K PBR source variation
as a 157,402-triangle LOD0 (0-42 m) and a 39,760-triangle LOD1 (42-88 m), then
hand off to the shared crossed-card LOD2 (88-150 m). They have no collision,
are omitted by Competitive Low, and do not turn the procedural/card mass forest
into a fully authored 3D tree pack. Source, hashes, and conversion details are
in `assets/environment/polyhaven-fir-sapling-runtime/`.
Fern 02 streams only after the core mission is playable, and only at High, Ultra,
or Extreme vegetation with a non-Low texture tier. Competitive Low does not
request or render Fern 02, and its original 4K maps are excluded from lower
graphics profiles.

## Asset licensing

Read `THIRD_PARTY_ASSETS.md` before redistribution. The original license files
remain beside every bundled third-party model:

- `assets/ar15/license.txt`
- `assets/m9/license.txt`
- `assets/soldier/license.txt`
- `assets/environment/polyhaven-fir-sapling-runtime/LICENSE.txt`

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
asset was accepted into the build 5.8.0-FIR-LOD runtime.
