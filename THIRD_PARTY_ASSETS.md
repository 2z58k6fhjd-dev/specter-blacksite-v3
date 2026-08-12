# SPECTER: Blacksite - Asset Provenance and License Manifest

This manifest distinguishes assets that ship with build `5.11.0-GRAPHICS-APPLY` from links retained
only for research. A source appearing in a research table does not mean its
files were downloaded, integrated, or redistributed.

## Bundled third-party 3D assets

| Asset | Author and source | License | Runtime use | Local record |
| --- | --- | --- | --- | --- |
| Russian Soldier | mamont nikita, [Sketchfab source](https://sketchfab.com/3d-models/russian-soldier-5b80f94ef8ab422590185950f5ea029a) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Shared rigged source for enemies and the derived SPECTER operator | `assets/soldier/license.txt` |
| AR15 Rifle | Lokeig, [Sketchfab source](https://sketchfab.com/3d-models/ar15-rifle-8a1a6552bd4b4466ad6f0bb488b0bcb3) | [CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) | HK416 viewmodel; full source clones used by the C5-K, R7.62, and MCR-300 player variants; and full textured enemy weapon clones | `assets/ar15/license.txt` |
| Beretta M9 GameReady | Plaxa, [Sketchfab source](https://sketchfab.com/3d-models/beretta-m9-gameready-a094ee27db654bc48950f8172d4059d6) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Tan M9A4 viewmodel with animated slide behavior | `assets/m9/license.txt` |

### Required AR-15 notice

This work is based on [AR15 Rifle](https://sketchfab.com/3d-models/ar15-rifle-8a1a6552bd4b4466ad6f0bb488b0bcb3)
by [Lokeig](https://sketchfab.com/lokeig), licensed under
[CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/).

The license requires attribution and does not permit commercial use. The build
uses this art directly for the HK416 and as a full cloned textured source for
the C5-K, R7.62, and MCR-300 player variants and every enemy weapon. All player
and enemy implementations using that source therefore inherit the non-commercial
restriction. Do not market or sublicense this package as commercially cleared
weapon art without replacing that source or obtaining separate permission from
its author.

### Other required model notices

The M9 viewmodel is based on
[Beretta M9 GameReady](https://sketchfab.com/3d-models/beretta-m9-gameready-a094ee27db654bc48950f8172d4059d6)
by [Plaxa](https://sketchfab.com/plaxa3), licensed under
[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

The character rig is based on
[Russian Soldier](https://sketchfab.com/3d-models/russian-soldier-5b80f94ef8ab422590185950f5ea029a)
by [mamont nikita](https://sketchfab.com/mamontnikita62), licensed under
[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

Keep the three local license files with every redistribution.

### Bundled CC0 environment props

[Steel Frame Shelves 01](https://polyhaven.com/a/steel_frame_shelves_01) by
James Ray Cock is bundled at a 2K browser-quality tier as facility set dressing.
Poly Haven publishes the asset under **CC0 1.0**. The official glTF, buffer, and
three texture maps are retained in
`assets/environment/polyhaven-steel-frame-shelves-01/`, together with source
links, official MD5 checksums, and a local license record. The project only adds
placement, scale, collision, and rendering behavior.

[Power Box 01](https://polyhaven.com/a/power_box_01) by Rico Cilliers
(modeling/texturing) and Yann Kervran (rigging) is bundled at a 2K
browser-quality tier as the recessed, wall-mounted cabinet around the interactive
facility breaker. Poly Haven publishes it under **CC0 1.0**. The official glTF,
buffer, and three texture maps live in
`assets/environment/polyhaven-power-box-01/` with local source links, official
MD5 checksums, and a license record. Its static source door is hidden at runtime
so the project's own mission door and lever retain their animated use-state; the
cabinet art itself is not altered.

[Plastic Container](https://polyhaven.com/a/plastic_container) by PierreB3D is
bundled at a 2K browser-quality tier as six shared-geometry exterior storage
and cover props. Poly Haven publishes it under **CC0 1.0**. The official glTF,
buffer, and three texture maps are retained in
`assets/environment/polyhaven-plastic-container/`, together with source links,
official MD5 checksums, and a local license record. The project only adds
placement, scale, collision, and rendering behavior.

[Concrete Road Barrier 02](https://polyhaven.com/a/concrete_road_barrier_02) by
Amal Kumar is bundled at a 2K browser-quality tier as six shared-geometry
checkpoint and perimeter hard-cover props. Poly Haven publishes it under
**CC0 1.0**. The 43K-triangle source model, buffer, and three 2K texture maps
are retained in `assets/environment/polyhaven-concrete-road-barrier-02/` with
official source links, MD5 checksums, and a local license record. The project
only adds placement, scale, collision, frustum culling, and rendering behavior.

[Fern 02](https://polyhaven.com/a/fern_02) by Rico Cilliers (modeling) and Rob Tuytel (scanning) is bundled as a raw 4K source set in
`assets/environment/polyhaven-fern-02/`: the original glTF, buffer, and 4K
albedo, normal, ARM, and official alpha-mask maps. Poly Haven publishes the
asset under **CC0 1.0**.
The folder's `README.md` and `LICENSE.txt` preserve the source and license
record alongside the runtime files.
The runtime leaf-cutout mask is the official
[`fern_02_alpha_4k.png`](https://dl.polyhaven.org/file/ph-assets/Models/png/4k/fern_02/fern_02_alpha_4k.png),
retained locally at `textures/fern_02_alpha_4k.png`; its verified MD5 is
`520e194db987df18fd73b49d979ada0c`.
The runtime streams sparse, non-colliding Fern 02 dressing only after the core
mission is playable, when vegetation density is High, Ultra, or Extreme and the
texture tier is High or 4K-preferred. It uses Fern 02's official alpha mask at runtime for
leaf cutouts. Competitive Low does not request or render Fern 02. The raw 4K
maps remain excluded from lower vegetation budgets, and no Fern file is
service-worker precached.

[Fir Sapling](https://polyhaven.com/a/fir_sapling) by Rico Cilliers (modeling)
and Rob Tuytel (photography) is bundled as a bounded 1K-derived high-tier
runtime layer in `assets/environment/polyhaven-fir-sapling-runtime/`. Poly Haven
publishes the source under **CC0 1.0**. The local `README.md`, `LICENSE.txt`, and
`manifest.json` retain the official source links, source MD5 values, output
SHA-256 values, and conversion record. The runtime keeps one source variation as
a 157,402-triangle PBR LOD0 (0-42 m) and a 39,760-triangle PBR LOD1 (42-88 m),
then uses the project PBR crossed-card LOD2 from 88-150 m. Six sparse,
non-colliding hero placements use that full chain. A separate LOD1-only
instanced detail band uses the same screened mesh in two shared material draws:
up to 6 nearest placements at High, 14 at Ultra, and 16 at Extreme within 124 m.
Both layers stream after core mission readiness only at High, Ultra, or Extreme
vegetation with a Standard, High, or 4K-preferred texture tier. Competitive Low/Intel neither requests
nor renders them, and the folder is not service-worker precached. These
derivatives add bounded close/mid detail; they do not make the procedural/card
mass forest a full authored 3D or AAA forest.

## Project-authored and derived runtime assets

| Asset | Creation and dependency record | Runtime status |
| --- | --- | --- |
| SPECTER operator | Runtime adaptation of the bundled Russian Soldier rig, with project-authored black-multicam treatment and equipment geometry; same CC BY 4.0 attribution obligation | Bundled through `src/specter-operator.js`; notes in `assets/player/README.txt` |
| Enemy role variants | Twelve runtime enemies in five roles, all derived from the same bundled Russian Soldier rig with project-authored material, health, AI, and visible equipment variation: role carriers, helmets/caps, packs, radios, pouches, headsets, command kit, and breacher armor; each carries a full textured clone of the bundled AR-15 with role-specific scale, tint, and suppressor treatment | Bundled; not represented as five separate source character models; soldier CC BY 4.0 and AR-15 CC BY-NC 4.0 obligations both apply |
| C5-K Compact Carbine | Full high-resolution clone of the bundled AR-15 source with project-authored compact proportions, material tint, handling data, and anchors | Bundled and player-selectable; CC BY-NC 4.0 applies through the source clone |
| R7.62 Designated Rifle | Full high-resolution clone of the bundled AR-15 source with project-authored marksman proportions, material tint, handling data, and anchors | Bundled and player-selectable; CC BY-NC 4.0 applies through the source clone |
| MCR-300 Suppressed | Full high-resolution clone of the bundled AR-15 source with a project-authored suppressor, material tint, handling data, and anchors | Bundled and player-selectable; CC BY-NC 4.0 applies through the source clone |
| Facility, exterior compound, vehicles, props, extraction zone, and non-explorable PNW perimeter forest | Project-authored procedural Three.js geometry; its baseline forest is a texture-free instanced fallback beyond the boundary, with no collision or explorable terrain | Bundled |
| High-tier fir-tree photo-tree impostors | Project-generated optional `assets/environment/generated/fir-tree-billboard-v1.png` plus the Douglas-fir v2 albedo/normal/roughness card maps; loaded into `environmentTextures.firCards` and used through shared instanced PBR materials | High/Ultra/Extreme vegetation only; absent when the non-critical texture fetch fails; these remain 2D impostors, not photogrammetric or AAA forest geometry. The separate bounded CC0 Fir Sapling derivative is documented above. |
| Bounded high-tier Fir Sapling derivatives | One CC0 Poly Haven 1K source variation (`fir_sapling_a`) is converted into local PBR LOD0 and LOD1 glTF derivatives, then hands off to the project crossed-card LOD2 | Six sparse, non-colliding hero LOD0/1/2 placements plus an LOD1-only instanced detail band: 6 nearest at High, 14 at Ultra, and 16 at Extreme within 124 m, sharing two material-part draws. Hero LOD0: 157,402 triangles at 0-42 m; LOD1: 39,760 triangles at 42-88 m; LOD2 card: 88-150 m. Lazy post-readiness at High/Ultra/Extreme with a Standard, High, or 4K-preferred texture tier; no Competitive Low/Intel request or service-worker precache. This is bounded close/mid-detail augmentation, not a dense authored 3D forest. |
| Weapon action timelines | Project-authored marker choreography for reload, equip, and chamber/bolt-check actions; markers synchronize magazine/action/ready events, visual motion, and existing sound cues | Bundled; not imported mocap or a third-party animation pack |
| Tactical death drops | Project-authored detach, throw, settle, and cleanup behavior for each defeated enemy's existing carried rifle and role equipment | Bundled presentation only; no pickup, inventory, or loot assets/system |
| Forest-gate pursuit extraction | Project-authored gate, camera/controller handoff, pursuit audio/visual cues, subtitles, and victory transition | Bundled controlled end beat; no additional licensed scenario asset or post-gate combat space |
| Audio director, enemy subtitle presentation, and fallback layers | Project-authored Web Audio synthesis, mixing, subtitles, separate voice bus, and deterministic fallbacks; recorded assets are listed separately below | Bundled through `src/audio-overhaul.js` and the main runtime |

The C5-K, R7.62, and MCR-300 runtime weapons are complete high-resolution AR-15
source clones with project-authored variant treatments. They are not claimed to
be separately licensed AAA scans, photogrammetry, or manufacturer-supplied CAD.
Enemy rifles likewise preserve the full bundled AR-15 mesh and textures instead
of using procedural weapon silhouettes. Role-specific proportions, tints, and
suppressors do not remove the source license obligation; CC BY-NC 4.0 applies to
every enemy weapon clone.

### Bundled optional prototype - not runtime-integrated

`src/modern-arsenal.js` is preserved as an optional project-authored prototype
module. It contains compact-carbine, marksman-rifle, and procedural T12 tactical
autoloader factories plus metadata and animation anchors. Build 5.11.0-GRAPHICS-APPLY does not
import, execute, or precache this module, and no runtime weapon slot selects it.
In particular, the procedural T12 failed the final close-up art-quality gate and
has no selectable slot; slot 5 is the full-source MCR-300 suppressed rifle
instead. The T12 code has no third-party model dependency, but its presence in
the repository must not be described as a shipped player weapon.

## Project-generated environment materials

### PBR v2 runtime set

`assets/environment/pbr-v2/` contains eight material families and 23 runtime
2048 x 2048 WebP maps:

- concrete: albedo, OpenGL normal, packed ORM
- painted metal: albedo, OpenGL normal, packed ORM
- diamond plate: albedo, OpenGL normal, packed ORM
- asphalt: albedo, OpenGL normal, packed ORM
- utility panel: albedo, OpenGL normal, packed ORM
- vehicle paint: albedo and packed ORM
- vehicle rubber: albedo, OpenGL normal, packed ORM
- grass and soil: albedo, OpenGL normal, packed ORM

Concrete, painted-metal, asphalt, and grass/soil source PNGs were generated for
SPECTER on 2026-08-08 with OpenAI's built-in image-generation mode. Exact prompts,
source hashes, retained inputs, and QA notes are in
`assets/environment/pbr-v2/README.md` and `manifest.json`. Diamond plate, utility
panels, vehicle paint, vehicle rubber, all derived normal/ORM maps, and QA
previews were produced by the project-authored deterministic builder in that
folder.

No downloaded stock texture or third-party photograph is used in PBR v2. These
materials are project-generated; they are not asserted to be CC0 or public
domain. Their distribution and use remain subject to the project owner's rights
and applicable OpenAI terms. Keep the folder README and manifest with source
redistributions.

### Low-payload derivatives

`assets/low-textures/` is a reproducible, project-generated 512px-max derivative
of the bundled runtime texture files. `scripts/build-low-textures.py` records
the source and derivative hashes, dimensions, and byte counts in its local
manifest. It is a quality/performance derivative only: it adds no new model,
texture, or audio license and does not replace the attribution requirements of
the original source folders.

`assets/medium-textures/` is the matching project-generated 1024px-max derivative
tier produced by `scripts/build-medium-textures.py`. Performance/Balanced and
custom Medium startup can select it before the original 2K images decode. It is
not a new third-party source and inherits the licenses of the source asset
folders; `manifest.json` records the source and derivative hashes.

### Preserved legacy generated materials

The original `concrete-wall.webp`, `metal-floor.webp`, `utility-panels.webp`, and
`grass-field-v1.webp` files were generated specifically for this project with
OpenAI image generation on 2026-08-08. They are preserved with their records in
`assets/environment/README.txt`, but build 5.11.0-GRAPHICS-APPLY uses the PBR v2 set for its main
runtime materials.

## Bundled recorded weapon reports

`assets/audio/cc-by-3.0-tabasco/` contains two short, normalized and faded
derivatives from [Gunshot Sounds](https://opengameart.org/content/gunshot-sounds)
by Vincent Sevedge / Tabasco. The archive's included `creativecommons.txt` is
preserved as `LICENSE.txt` and is authoritative: **CC BY 3.0 Unported**. The
runtime derivatives are `rifle-sks-01.wav` and `pistol-cz-01.wav`; they add
recorded transient layers while the project-authored Web Audio system keeps
spatial tails, suppression, and fallback behavior. Attribution to Vincent
Sevedge / Tabasco and the CC BY 3.0 notice must remain with redistributions.

## Bundled M9A4 reload foley

`assets/audio/cc0-zer0-sol-handgun-reload/reload.wav` is the unmodified
1.5906-second stereo WAV from [Handgun Reload Sound Effect](https://opengameart.org/content/handgun-reload-sound-effect)
by zer0_sol. The source declares **CC0 1.0 Universal**; the local
`LICENSE.txt`, `README.md`, and SHA-256 receipt preserve that provenance. It
plays as a low-gain full-sequence layer only on the M9A4 empty reload, while
the project's marker-synced magazine/slide sounds remain present and supply a
complete fallback if the recording cannot fetch or decode.

## Research-only 3D candidates - not bundled

For a license-screened, non-runtime candidate list with model, animation, sound,
and browser-budget acceptance gates, see [`ASSET_CATALOG.md`](ASSET_CATALOG.md).
It does not alter the attributions or local license records in this manifest.

The following links are retained for future evaluation. None of these candidate
archives or models should be described as included in build 5.11.0-GRAPHICS-APPLY unless a future
commit adds the source files, local license receipt, author, conversion notes,
optimization record, and runtime integration.

### Characters and animations

| Candidate | License shown at research time | Possible future use |
| --- | --- | --- |
| [FREE Military Soldier Rigged](https://sketchfab.com/3d-models/free-military-soldier-rigged-e9c56308a67d4a3db62e914fafa4d198) by BAMEN | CC BY 4.0 | Modern common-enemy source after full quality, rig, license, and LOD review |
| [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 | Locomotion and armed-combat animation reference |
| [Modern Soldier](https://sketchfab.com/3d-models/modern-soldier-358b4fb07f0146cb9b9063342db5897a) by Blue Spirit | CC BY 4.0 | Elite/commander candidate after texture and LOD review |
| [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) | CC0 | Civilian/security variety only if visual quality meets the final art bar |
| [S.W.A.T. Operator](https://sketchfab.com/3d-models/swat-operator-9e82fabf26194896b5ad4a364d864eab) by SpatialNeglect | CC BY 4.0; 106.7k triangles; rigged | Strong close-range tactical-enemy candidate. Requires a downloaded source, dependency attribution audit, browser LODs, and final art review before use. |
| [FSB Operator](https://sketchfab.com/3d-models/fsb-operator-43a561e941704eefb1ab0614be4f0049) by SpatialNeglect | CC BY 4.0; 114.3k triangles; rigged | Distinct present-day hostile candidate. Requires the same source/dependency/LOD review before use. |
| [S.W.A.T. Operator Remaster](https://sketchfab.com/3d-models/swat-operator-4k-followers-special-remaster-f6923917c8014578b1c1cb2b4c249268) by SpatialNeglect | CC BY 4.0; 71.8k triangles | Alternate modern tactical silhouette for squad variation after the same review. |

### Weapons

All weapon research must remain grounded in currently fielded military or
law-enforcement equipment. Real-manufacturer lookalikes also remain subject to a
separate trademark and design review even when a mesh uses a permissive license.

| Candidate | License shown at research time | Possible future use |
| --- | --- | --- |
| [Modern Semi-Automatic Pistol](https://sketchfab.com/3d-models/modern-semi-automatic-pistol-game-ready-pbr-254d63584b73484092bfac7fe9cedca6) by Hafeez Ahmed | CC BY 4.0 | Generic sidearm with separate slide, trigger, and magazine |
| [M150 Sniper Rifle](https://sketchfab.com/3d-models/m150-sniper-rifle-game-ready-0f71498f1f694b30be77c9779361c6cc) by Bl4ckGh0st | CC BY 4.0 | Precision-rifle candidate with separately rigged action parts |
| [Ultimate Guns Pack](https://quaternius.com/packs/ultimategun.html) | CC0 | Background/pickup reference only if its final visual quality is acceptable |
| [US Marine Corps Infantry Rifle](https://sketchfab.com/3d-models/us-marine-corps-infantry-rifle-4276f2000d99445caf755f8356552254) by amogosse3D | CC BY 4.0; 46.1k triangles; 4K PBR | Modern service-rifle candidate with separate action parts, pending direct source and provenance review. |
| [Modern Warfare M4A1](https://sketchfab.com/3d-models/modern-warefare-m4a1-167dd49ffff14d41ab11b6417f128bf1) by Nneako | CC BY 4.0; 70.9k triangles; 2K PBR | Modern carbine candidate, pending source, attribution, and independent-origin review. |
| [AK-74M Assault Rifle](https://sketchfab.com/3d-models/ak-74m-assault-rifle-9084c3bae8224d338103997bc3101480) by FJH | CC BY 4.0; 17.6k triangles; 4K PBR | Grounded modern rifle candidate; needs source, 2K runtime texture tier, and animation-anchor review. |

The following candidate was explicitly **rejected** despite its visible CC-BY
label because its description identifies it as ripped from a commercial game:
[Tactical M4 - Tan - COD:MW2022](https://sketchfab.com/3d-models/tactical-m4-tan-codmw2022-pbr-8ffacc2ad1cd44d1b3cf8da18ac66e8b). A creator-applied
license cannot establish rights for an unauthorized derivative asset.

### Environment, furniture, vehicles, and cover

The following candidates were identified under the
[Poly Haven license](https://polyhaven.com/license), which states CC0. They are
links only and are not bundled:

- [Utility Box 01](https://polyhaven.com/a/utility_box_01) - breaker-box candidate.
- [Steel Frame Shelves 01](https://polyhaven.com/a/steel_frame_shelves_01) - armory and maintenance storage.
- [Wooden Table 03](https://polyhaven.com/a/WoodenTable_03) - workbench and office dressing.
- [Plastic Crate 02](https://polyhaven.com/a/plastic_crate_02) and
  [Barrel 02](https://polyhaven.com/a/Barrel_02) - repeated clutter.
- [Modular Chainlink Fence](https://polyhaven.com/a/modular_chainlink_fence) - exterior boundary candidate after LOD and texture optimization.
- [Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01) - additional
  checkpoint-cover candidate.
- [Shrub 03](https://polyhaven.com/a/shrub_03), [Rock 07](https://polyhaven.com/a/rock_07),
  and [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) - exterior set
  dressing candidates. Fern 02 is documented above as a bundled CC0 source set,
  not a research-only runtime asset.
- [Kloofendal 48d Partly Cloudy](https://polyhaven.com/a/kloofendal_48d_partly_cloudy) - environment-lighting candidate, to be reduced to a browser-safe runtime map.

The [Ural 4320](https://sketchfab.com/3d-models/ural-4320-f953c51a5dbc4a15949f4dcc0905c4e8)
by Brout was identified as a CC BY 4.0 present-day military truck candidate. It
is not bundled; build 5.11.0-GRAPHICS-APPLY uses project-authored procedural vehicle geometry.

## Bundled tactical voice callouts

`assets/audio/cc0-kenney-voiceover/` contains fourteen unmodified OGG clips from
[Kenney Voiceover Pack #1](https://www.kenney.nl/assets/voiceover-pack/). The
official package's `License.txt` and `Credits.txt` are retained locally. Kenney
licenses the pack as **CC0 1.0**, so the clips are permitted in personal and
commercial projects; the source records the male actor as Jeffrey M. Smith and
the female actor as Giselle. The runtime chooses between male and female
variants for contact, investigation, backup, flanking, retreat, suppression, and
downed enemy states, then passes each through positional/radio processing. The
runtime presents role/callsign subtitles for those calls and provides a persistent
Voice Volume slider on its own voice bus, separate from effects and music. The
clips are not AI-generated voices; they are licensed human-performed recordings.
If a recorded call cannot download or decode, the project-authored procedural
fallback keeps the encounter functional without substituting a new bundled voice
asset.

## Bundled player footsteps

`assets/audio/cc0-kenney-rpg-footsteps/` contains ten unmodified OGG footstep
clips from [Kenney RPG Audio](https://www.kenney.nl/assets/rpg-audio). The
package `License.txt` is retained locally and names Kenney Vleugels / Kenney.nl
as the author. The pack is **CC0 1.0**, so the recordings are permitted in
personal and commercial projects. The runtime randomly selects a clip, then
applies hard-floor filtering inside and grass filtering outside; an entirely
procedural fallback remains available if a clip cannot download or decode.

## Research-only audio candidates - not bundled

Build 5.11.0-GRAPHICS-APPLY uses project-authored procedural Web Audio,
the separately documented CC BY 3.0 recorded report derivatives, zer0_sol CC0
M9 empty-reload layer, and Kenney CC0 tactical callouts and player footsteps.
The following pages remain research links only;
no additional source master or runtime derivative from them ships in this
repository:

- [AR15 rifle shot](https://freesound.org/people/michorvath/sounds/427596/) and
  [9 mm pistol shot](https://freesound.org/people/michorvath/sounds/427592/) - close transients.
- [M4 rifle reload](https://freesound.org/people/Freeman213SG/sounds/326042/) - possible animation-synced mechanism.
- [Equipment clicks III](https://opengameart.org/content/equipment-clicks-iii) - selector, magazine, and action sweeteners.
- [Bouncing shell casings](https://freesound.org/people/GryffDavid/sounds/318964/) - rifle/pistol casing variations.
- [Kenney Impact Sounds](https://www.kenney.nl/assets/impact-sounds) - concrete, metal, wood, and prop impacts.
- [Circuit Breaker 1 SP](https://freesound.org/s/130152/) - breaker sync layer.
- [Concrete footsteps](https://freesound.org/people/SecureSubset/sounds/813622/) and
  [grass footsteps](https://freesound.org/people/Fission9/sounds/521587/) - surface-aware movement.
- [Outdoor forest ambience](https://freesound.org/people/Nox_Sound/sounds/570492/) and
  [low-frequency HVAC room tone](https://freesound.org/s/215293/) - zone ambience.

Before any researched audio enters a public build, archive the original source,
author, exact license receipt, source URL, editing notes, and runtime derivative.

## Explicitly rejected and excluded content

Build 5.11.0-GRAPHICS-APPLY does not integrate sci-fi, futuristic, fantasy, anachronistic,
cartoon, stylized, or visibly low-detail research assets. Small or stylized
soldier and vehicle downloads used during research were rejected as final art
and are not part of the runtime repository. Earlier rejected experimental
vegetation billboards also remain outside the runtime because they did not meet
transparency and quality requirements. They are distinct from the specifically
documented project-generated high-tier fir impostor, which remains a constrained
2D background treatment rather than a claim of AAA tree geometry.

The project-authored procedural T12 prototype is likewise excluded from the live
loadout after failing the close-up weapon-art gate. Its optional source module is
preserved for future iteration, but it is not imported, executed, precached,
runtime-selected, or presented as runtime content.

Only grounded present-day military, law-enforcement, industrial, and civilian
design language is eligible for future integration. A candidate's permissive
license does not override the visual-quality, technical, or provenance review.

## Browser performance and integration rules

- Convert accepted runtime models to GLB and evaluate Meshopt/Draco only after
  measuring decode cost.
- Prefer KTX2/Basis textures; keep raw 4K maps limited to first-person hero
  weapons, a single elite character, or the documented sparse High/Ultra/Extreme
  Fern 02 dressing.
- Target 1K-2K textures and at least three LODs for repeated props and common
  enemies.
- Use instancing for vegetation, fences, barriers, and perimeter forest layers.
- Never ship million-triangle grass or multi-million-triangle trees directly;
  bake cards and LODs first, then visually verify them.
- Keep source and license archives outside the runtime preload list while still
  preserving them in the distributable project record.
- AUTO uses browser-reported capabilities plus a short runtime benchmark only;
  it is a conservative starting estimate, not a precise measure of available
  VRAM. Manual profiles and custom settings remain available to the player.
- The custom panel exposes an independent fixed internal-resolution ladder
  from Auto through 240p, 360p, 480p, 720p, 900p, 1080p, 1440p, and 2160p/4K,
  plus Low 512px, Medium 1K, Standard/High 2K, and 4K-preferred texture tiers.
  Fixed resolution controls internal rendering rather than a monitor mode and
  remains subject to browser render-target limits. Texture-tier changes remain reload-bound so the
  game never blanks already-loaded materials while a larger or smaller pack is
  being selected.
- The experimental ray-tracing controls are capability-gated. On the current
  WebGL backend, reflection requests use a visible bounded SSR profile,
  indirect-light requests use SSAO plus ambient light, and shadow requests use
  the selected PCF shadow-map path. The FSR2 request actively renders at 77% of
  the selected render scale before browser output scaling. These are explicitly
  labeled approximations, not claims of native hardware ray tracing or AMD
  FSR2 temporal reconstruction.
- Competitive Low selects a project-generated 512px-max derivative of bundled
  weapon, soldier, set-dressing, and PBR texture files before decode on a fresh
  Low launch, while deliberately reducing grass, dense foliage, shadows, and
  post-processing. It introduces no new third-party license or provenance;
  source attribution remains with the original asset folders. It must not be
  advertised as the high-detail close-up texture mode.
- Keep the current perimeter forest outside the collision boundary. It is a
  project-authored, texture-free LOD backdrop at its baseline and not an
  authored high-detail foliage pack or an explorable forest map.
- The project-generated photo-tree impostors are allowed only at High, Ultra,
  and Extreme vegetation density. The Douglas-fir v2 card includes retained
  project-generated albedo, normal, and roughness maps, but remains a
  non-colliding, shared-material instanced 2D impostor. Do not relabel either
  card as scanned/modelled 3D trees or an AAA foliage asset. If optional texture
  data is unavailable, omit the batch and retain the procedural forest fallback.
- The bounded CC0 Fir Sapling derivatives may stream only after core mission
  readiness at High, Ultra, or Extreme vegetation with a Standard, High, or
  4K-preferred texture tier.
  Keep the six non-colliding 1K PBR LOD0/LOD1 placements outside the collision
  boundary, preserve their 0-42 m / 42-88 m / 88-150 m LOD handoff, and exclude
  them from Competitive Low/Intel and service-worker precaching. They are sparse
  close-detail augmentation, not permission to relabel the procedural/card mass
  forest as a dense, fully authored 3D or AAA forest.
- Fern 02's bundled raw 4K glTF/JPG source set streams only after the core
  mission is playable, at High, Ultra, or Extreme vegetation density with a
  High or 4K-preferred texture tier. Its official alpha mask is used at runtime for leaf
  cutouts, and Competitive Low does not request or render it. Keep Fern files
  out of the service-worker precache list.
