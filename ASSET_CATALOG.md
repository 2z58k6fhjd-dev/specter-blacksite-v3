# SPECTER: Blacksite — License-Screened Asset Candidate Catalog

**Catalog status:** research only, reviewed 2026-08-11. Nothing in this file is
bundled, streamed, precached, or selected by the current runtime merely because
it appears below. The authoritative record for assets already in the game remains
[`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md) and the license files beside
those assets.

This catalog is deliberately narrower than a general asset wish list. A source is
listed only when its own landing page showed **CC0** or **CC Attribution (CC BY)**
at review time. A permissive label is necessary, not sufficient: the source
archive, its dependencies, its actual provenance, and its visual quality still
need to pass the gates below before staging. Never infer rights from a filename,
search-result snippet, an uploader comment, or a creator-applied license on an
unauthorized game rip.

## Status key

| Status | Meaning |
| --- | --- |
| **Screened research candidate** | The linked source page showed CC0 or CC BY at the stated review date. It has not been downloaded, audited, optimized, or put in the game. |
| **Technical reference only** | Useful for testing an import, animation, or audio pipeline, but not eligible as final close-up art without a separate visual-quality approval. |
| **Not an approved asset** | It is intentionally excluded from the current build, even if it is real-world and permissively licensed. |
| **Bundled—see manifest** | Already ships and is governed by `THIRD_PARTY_ASSETS.md` plus its local license record; this is not a relicensing claim. |

## Current runtime boundary

- SPECTER's live era is present-day military, law-enforcement, industrial, and
  civilian equipment. No sci-fi, fantasy, cartoon, visibly low-detail, or
  anachronistic asset may enter the playable loadout.
- Historic weapons in this catalog are **archive, collectible-prop, and
  mechanical-animation references only** unless a future mission/art decision
  explicitly changes that boundary. They are not proposed as default playable
  weapons.
- The bundled AR-15 source is CC BY-NC 4.0 and the bundled M9 is CC BY 4.0. Their
  attribution and restrictions are documented in
  [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md); the AR-15's non-commercial
  restriction is not erased by this CC0/CC-BY-only research catalog.
- No source in this document should be hotlinked from a game build. Any accepted
  asset must be copied into the repository with its own local provenance record.

## Screened weapon-model candidates

Page-reported figures are source metadata, not SPECTER performance measurements.
`Format not stated` means the public page did not expose the source archive format
in the reviewed metadata; it must be confirmed from the downloaded archive before
acceptance.

### Present-day candidates

| Candidate and source | License shown by source | Page-reported format / geometry / textures | Intended fit and status | Required model-specific check |
| --- | --- | --- | --- | --- |
| [US Marine Corps Infantry Rifle — amogosse3D](https://sketchfab.com/3d-models/us-marine-corps-infantry-rifle-4276f2000d99445caf755f8356552254) | CC Attribution (CC BY) | Format not stated; 46.1k triangles, 25.4k vertices; 4K PBR; page describes a separate bolt carrier group, muzzle device, trigger, selector, charging handle, and magazine. | **Screened research candidate** for a distinct modern service rifle only after optimization. | Verify downloadable archive, author/originality, part pivots, and material licenses. Retopology/LODs are mandatory; source LOD0 exceeds the default hero target below. |
| [AK-74M Assault Rifle — FJH](https://sketchfab.com/3d-models/ak-74m-assault-rifle-9084c3bae8224d338103997bc3101480) | CC Attribution (CC BY) | Format not stated; 17.6k triangles, 9.5k vertices; 4K PBR; source says mesh parts are named for rigging/animation. | **Screened research candidate** for a grounded opposing-force rifle. | Independently check the source's originality, exact archive license, separated bolt/magazine/selector pivots, and a 2K/default plus 512px/Low texture derivative. |
| [M4A1 — TORI106](https://sketchfab.com/3d-models/m4a1-33107f38b23c45cc8103768c0e961cdf) | CC Attribution (CC BY) | Format not stated; 9.2k triangles, 4.8k vertices; texture resolution and part separation not stated. | **Screened research candidate** only as a low-geometry base to evaluate—not an automatic hero-weapon recommendation. | Reject if it cannot support separate magazine, bolt/charging handle, trigger, and muzzle anchors or if its close-up materials fail review. |
| [M4A1 — Avishkar Kadam](https://sketchfab.com/3d-models/m4a1-430cecb5473e4034b31a37d9e6f33ab2) | CC Attribution (CC BY) | Format not stated; 12.1k triangles, 6.1k vertices; page lists 4096px base-color, roughness, metallic, height, and normal maps. | **Screened research candidate** for a modern carbine replacement study. | Confirm independent creation, separate moving parts, and that the 4K source can be downsampled/baked without losing needed receiver and optic detail. |

### Historic/reference candidates

| Candidate and source | License shown by source | Page-reported format / geometry / textures | Intended fit and status | Required model-specific check |
| --- | --- | --- | --- | --- |
| [M1 Garand Game Asset — Szyszz](https://sketchfab.com/3d-models/m1-garand-game-asset-5e8c64c1c63a4ac3b52a351c28de50f1) | CC Attribution (CC BY) | Format not stated; 23.1k triangles, 11.9k vertices; texture size not stated. | **Screened research candidate** for a non-playable archive prop or historical mechanics reference. | Verify source files, author/originality, texture dependencies, and clip/bolt separation. It remains outside the modern playable loadout by default. |
| [M1911 Pistol with magazine and bullet — DanaeH](https://sketchfab.com/3d-models/m1911-pistol-with-magazine-and-bullet-131085c22ece47a08076d8ddc0b9f21a) | CC Attribution (CC BY) | Format not stated; 12.2k triangles, 6.4k vertices; page describes a textured, to-scale model but does not state map resolution. | **Screened research candidate** for an archive prop or slide/magazine animation reference. | Confirm all dependency licenses, extractable slide/magazine/trigger parts, and close-up PBR quality. No default gameplay use without scope approval. |
| [Lightning Pump Action Rifle — LonesomeDucky](https://opengameart.org/content/lightning-pump-action-rifle) | CC0 | ZIP contains `.blend` and `.glb`; low-poly GLB is 3,058 triangles / 2,356 vertices with 2048px PBR textures; basic pump and trigger animations. | **Technical reference only.** It is a useful GLB, PBR, and moving-part import test but its explicitly low-poly presentation is not approved final SPECTER weapon art. | Use only to validate part-pivot and animation import. Do not upgrade it into a hero asset merely with sharpness/upscaling. |
| [Revolver Game Asset — loafbrr_1](https://opengameart.org/content/revolver-game-asset) | CC0 | Archive advertises FBX, glTF, and Blend; 4,028 triangles; 1K textures; shoot and reload animation. | **Technical reference only.** Useful for validating an asset-owned reload clip and animation import. | Historic and visibly light-weight: never substitute for a modern AAA-style player weapon. Confirm baked texture/material behavior after GLB conversion. |

## Reload and weapon-animation sources

SPECTER needs separate first-person hand/viewmodel choreography and third-person
character action clips. A clip that moves a generic humanoid does not by itself
solve first-person finger contact, optic alignment, magazine timing, or weapon
part motion.

| Candidate and source | License shown by source | Reported delivery / scope | Status and use boundary | Acceptance gate |
| --- | --- | --- | --- | --- |
| [Universal Animation Library — Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | CC0 | FBX, GLB, and Blend; 120+ universal-humanoid animations, including locomotion, combat, and gun categories; root-motion and in-place variants are described by the source. | **Screened research candidate** for third-person locomotion, death, transition, and armed-body reference. The landing page does not guarantee a weapon-specific reload that matches SPECTER's models. | Downloaded clip list must be recorded; identify the exact clip(s); map to the 127-joint soldier rig; prove root-motion handling, contact timing, and no shoulder/hand collapse. No clip is staged until that retarget report passes. |
| [Lightning Pump Action Rifle — LonesomeDucky](https://opengameart.org/content/lightning-pump-action-rifle) | CC0 | GLB/Blend source with basic pump and trigger animation; 3,058 triangles and 2K textures. | **Technical reference only** for asset-owned moving-part animation. | It cannot provide player hand/arm motion. Its clips may only establish a mechanical timing reference after import validation. |
| [Revolver Game Asset — loafbrr_1](https://opengameart.org/content/revolver-game-asset) | CC0 | FBX/glTF/Blend package; shooting and reload animation; 4,028 triangles, 1K textures. | **Technical reference only** for a contained weapon animation pipeline. | It cannot be relabeled as a high-detail modern animation solution. Verify clip action names, timeline endpoints, and permitted conversion before any use. |

### Explicit animation gap

No source above is an approved, matched first-person modern rifle/pistol reload
package. Until a candidate clears the retarget, contact, and visual gates,
SPECTER must continue to label its existing reload/equip/chamber timelines as
**project-authored choreography**, not imported motion capture. Sources using
non-commercial or other non-CC0/non-CC-BY terms are intentionally outside this
catalog and must not be staged as a substitute.

## Screened weapon-audio candidates

All candidates below are **not bundled**. Their URLs and source-page terms must
be saved with the original download before any edit, transcoding, normalization,
or runtime inclusion. Use a dry, close source only as one layer; game reports
need authored close, mechanical, reflection, and occlusion layers rather than
one copied sound stretched across every weapon.

| Candidate and source | License shown by source | Reported source format / size / content | SPECTER use and status | Audio-specific gate |
| --- | --- | --- | --- | --- |
| [The Free Firearm Sound Library — Ben Jaszczak et al.](https://opengameart.org/content/the-free-firearm-sound-library) | CC0 | Prepared library archive: 194 MB; source describes carbine, pistol, rifle, shotgun, pump-action, bolt-action, handgun, and revolver coverage. Individual source WAV specifications are not listed on the landing page. | **Screened research candidate** for a curated, role-specific weapon-report study. | Do not bulk-import the archive. Audit its included credits/license record, select only needed takes, inspect peak/noise/room tail, then ship web-friendly derivatives with their source names and hashes. |
| [Assault Rifle Reload — qubodup](https://freesound.org/people/qubodup/sounds/815879/) | CC0 | WAV; 1.869 s; 44.1 kHz, 16-bit mono; 161.3 KB; full assault-rifle reload sequence. | **Screened research candidate** for a one-shot full-sequence comparison and timing reference. | Split only if the license and source waveform allow a useful, natural result; otherwise retain as one sequence. Check audible airsoft/source identity, clipping, and loop seams. |
| [Gun Reload Sound Effects — BMacZero](https://opengameart.org/content/gun-reload-sound-effects) | CC0 | WAV: `clipload1.wav` 22.6 KB, `clipload2.wav` 18.5 KB, `singlebullet1.wav` 26.7 KB. | **Screened research candidate** for isolated magazine and single-round sweeteners. | Audition at game distance and blend with authored cloth/weapon handling; do not make a tiny transient the whole reload. |
| [Gun reload sounds — SpringySpringo](https://opengameart.org/content/gun-reload-sounds) | CC0 | WAV: `gunreload1.wav` 278.6 KB, `assaultriflereload1.wav` 274.5 KB, `shotguncock.wav` 83.6 KB. | **Screened research candidate** for pistol/rifle/shotgun reload timing. | Treat as recorded Foley, not proof of a particular make/model. Check content suitability and synchronize only to verified animation markers. |
| [Handgun Reload Sound Effect — zer0_sol](https://opengameart.org/content/handgun-reload-sound-effect) | CC0 | `reload.wav`, 280.6 KB; source describes magazine drop, insertion, and slide rack. | **Screened research candidate** for M9-style empty-reload timing study. | Split into action layers only after a waveform review. Ensure the slide-rack marker follows the actual rendered slide/bolt action. |
| [equipment clicks III — LFA](https://opengameart.org/content/equipment-clicks-iii) | CC0 | `equipment_clicks3.wav`, 2 MB; source describes bolt-action, stapler, and tape-measure captures suitable for cocking/click layers. | **Screened research candidate** for subtle selector, latch, and mechanical foley—not weapon reports. | Very short click layers require level matching, randomization, and rate limiting to prevent repetition. Keep the real-source description in the local record. |
| [Shotgun Reload Sound effects — zer0_sol](https://opengameart.org/content/shotgun-reload-sound-effects) | CC0 | `shotgunsounds.zip`, 324.2 KB; shells loaded and pump-action operation. | **Screened research candidate** for a future grounded shotgun only. | Must remain unused until a modern, scoped weapon and animation are approved. Never make it a generic rifle reload fallback. |

### Existing recorded reports are not relicensed here

The live project already documents Tabasco/Vincent Sevedge's **Gunshot Sounds**
derivatives as CC BY 3.0 in its retained local license record. Although the
current [OpenGameArt listing](https://opengameart.org/content/gunshot-sounds)
now presents CC0 metadata, this catalog does **not** change the local record or
retroactively relicence any shipped derivative. Continue to follow
`THIRD_PARTY_ASSETS.md` and its preserved `LICENSE.txt` for the existing files.

## Acceptance gates before staging or integration

Every candidate must clear all applicable gates. Passing a later gate never
waives an earlier one.

| Gate | Required evidence / limit |
| --- | --- |
| **1. License and provenance** | Save the original archive, source URL, author/uploader, exact page license, download date, SHA-256, and a page/PDF capture. Accept only CC0 or CC BY. Audit every included texture, sound, rig, and dependency. Reject commercial-game rips, AI-training restrictions that conflict with project policy, unclear authorship, non-commercial/no-derivatives terms, and untraceable sublicenses. |
| **2. Art direction and legal review** | Present-day candidates must be grounded, realistic, and non-sci-fi. Historic references need explicit mission/art approval. Review logos, trademarks, military insignia, manufacturer marks, and third-party markings; remove/replace marks where approval requires it. Judge the mesh at first-person and third-person distances—no cartoon, placeholder, or visibly low-detail final content. |
| **3. Model conversion** | Preserve an untouched source archive outside the runtime preload path. Export one validated GLB/GLTF 2.0 runtime asset with named nodes, correct real-world scale, transforms applied, sane normals/tangents, packed PBR material slots, and no missing external references. Use Meshopt/Draco only after measured decode testing on the lowest supported path. |
| **4. Geometry and LOD budget** | First-person hero LOD0: target <= 35k triangles; a source above that must retopologize or justify a measured exception. World pickup/third-person LOD0: target <= 20k; LOD1 <= 8k; LOD2 <= 2.5k. Provide at least three LODs for repeated/world-visible assets and verify frustum/distance culling. Separate moving parts do not count as a reason to bypass the budget. |
| **5. Texture and VRAM budget** | Ship verified maps, not generated claims: Default High uses up to 2K PBR maps; Competitive Low receives real 512px derivatives; optional native 4K may be used only for a small, explicitly supplied High/Ultra/Extreme hero tier. Prefer KTX2/Basis after browser testing. No high-resolution texture may download on the Intel/Low path merely because a higher preset exists. |
| **6. Weapon mechanics** | Require named, independently testable anchors for muzzle, optic/camera alignment, magazine, ejection port, bolt/charging handle or slide, trigger, selector, flashlight, and optional suppressor. Inspect ADS at 16:9 and ultrawide: the sight picture must align with the raycast, the crosshair hides while ADS, and no muzzle flash originates behind the barrel. |
| **7. Animation and retargeting** | Record source clip name, duration/FPS, rig/bone map, root-motion choice, and author. Test idle, walk, sprint, ADS, recoil, tactical reload, empty reload, inspect, equip/holster, landing, and death/magazine/bolt/slide timing as applicable. Viewmodel hands must retain contact throughout; source animation never substitutes for the moving weapon components themselves. |
| **8. Audio handling** | Retain original audio and source metadata. Document the derivative chain, edit points, normalization/peak target, loop points, and runtime filename. Test close, suppressed, distant, indoor/outdoor, and overlapping-fire behavior; respect browser decoding/memory budgets and avoid repeated identical one-shots. |
| **9. Browser and release QA** | Test initial load, AUTO, Intel/Competitive Low, every preset, custom texture settings, and persistence on a supported browser. Confirm low paths request only low derivatives; audit network and decoded texture pressure; profile a multi-enemy firefight. Run the release/package validation and manually check attribution files before a GitHub Pages publish. |

## Recommended staging record

An accepted future asset should receive a small non-runtime directory such as
`assets/_staging/<asset-id>/` before being promoted. Include:

```text
SOURCE.md            author, page URL, license URL/text, review date, screenshot/PDF hash
LICENSE.txt          exact source license/attribution record
ORIGINAL.sha256      hash and original archive filename (archive kept out of preload)
conversion.md        tool/version, source nodes, output GLB hash, LOD/texture derivatives
qa.md                desktop + Intel/Low results, ADS/muzzle/animation/audio sign-off
```

Promotion then requires a corresponding entry in
[`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md), a local attribution/license
file, and a runtime asset manifest entry. Until all three exist, the candidate
remains research only.

## Explicit exclusions

- Do not use a Sketchfab/marketplace page as proof that the uploader owns a
  commercial-game extraction or third-party CAD model.
- Do not treat a 4K source map as proof of a real runtime 4K graphics tier; the
  actual maps, manifest, setting behavior, and browser memory test must exist.
- Do not substitute `CC BY-NC`, custom marketplace licenses, editorial-only
  material, or a no-download preview for the CC0/CC-BY sources cataloged here.
- Do not add a model or sound simply to increase item count. A smaller,
  visibly coherent, well-attributed present-day set is preferable to a mixed
  catalogue of unverified or low-detail assets.
