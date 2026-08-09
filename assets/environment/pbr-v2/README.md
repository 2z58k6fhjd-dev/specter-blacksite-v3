# SPECTER Environment PBR v2

This folder contains a grounded-modern, browser-ready environment material set for
SPECTER: Blacksite. All runtime maps are power-of-two 2048 x 2048 RGB WebP files.
The four generated source PNGs are retained under `sources/`; they and the QA
previews are provenance/build artifacts and should not be loaded by the game.

## Audit result

The previous environment set (`concrete-wall.webp`, `metal-floor.webp`,
`utility-panels.webp`, and `grass-field-v1.webp`) is useful as a placeholder, but
each material is a single base-colour texture. The game currently reuses those
images as bump maps, which treats colour changes as physical height and creates
unreliable relief. Exterior asphalt, vehicle paint, and vehicle rubber are flat
colours in `world-overhaul.js`.

PBR v2 separates colour from surface response and supplies a coherent packed ORM
map for every material. A normal map is included only where the surface has
defensible relief. Vehicle paint intentionally has no normal map; its smooth
clearcoat response belongs in material parameters rather than invented texture
height.

## Map convention

- `*-albedo.webp`: sRGB base colour. In Three.js, set `colorSpace` to
  `THREE.SRGBColorSpace`.
- `*-normal.webp`: tangent-space OpenGL normal, +Y / green-up. Treat as linear
  data (`THREE.NoColorSpace`).
- `*-orm.webp`: linear packed map using the glTF/Three.js convention: red =
  ambient occlusion, green = perceptual roughness, blue = metalness. Reuse the
  same texture object for `aoMap`, `roughnessMap`, and `metalnessMap`.
- Apply identical `RepeatWrapping`, repeat, offset, rotation, and UV channel to
  every map in one material. Use a neutral material colour (`0xffffff`) unless a
  deliberate tint is wanted.
- In Three.js releases that read AO from a second UV set, ensure the mesh has a
  compatible `uv1`/secondary UV attribute, or omit `aoMap` while retaining the
  green and blue ORM channels.

## Integration map

| Material | Runtime maps | Intended targets in the current scene | Scale starting point |
| --- | --- | --- | --- |
| `concrete` | albedo, normal, ORM | `worldMat`; facility walls/slabs; `concrete` and `darkConcrete` | one full tile per roughly 2.5-3.5 m |
| `painted-metal` | albedo, normal, ORM | doors, lockers, crates, barriers, painted structural steel | one full tile per roughly 1.5-2.0 m |
| `diamond-plate` | albedo, normal, ORM | `floorMat`; industrial walkways, landings, service-room floors | one full tile per roughly 1.5-2.0 m |
| `asphalt` | albedo, normal, ORM | `asphalt`; service road, exit apron, checkpoint, motor pool, storage yard, extraction pad | one full tile per roughly 3-4 m |
| `utility-panel` | albedo, normal, ORM | `metalMat`; breaker cabinets, equipment housings, wall service panels | one full tile per 2 m (four 0.5 m panels) |
| `vehicle-paint` | albedo, ORM | `paint`; armored response vehicle body | one full tile per roughly 1-1.5 m; no normal map |
| `vehicle-rubber` | albedo, normal, ORM | `rubber`; vehicle tires and rubber trim | one full tile per roughly 0.5-0.8 m |
| `grass-soil` | albedo, normal, ORM | `grassMaterial`; exterior perimeter terrain | one full tile per roughly 3-4 m |

These are visual starting points, not absolute scan scale. The procedural tread
and utility panel geometry do carry internally coherent scale: diamond tread has
eight 0.25 m pattern cells across a nominal 2 m tile, and the utility sheet has
four 0.5 m panels across a nominal 2 m tile.

Recommended normal-scale starting points (Three.js X/Y): concrete `0.55, 0.55`;
painted metal `0.25, 0.25`; diamond plate `0.8, 0.8`; asphalt `0.65, 0.65`;
utility panel `0.8, 0.8`; vehicle rubber `0.35, 0.35`; grass/soil `0.55, 0.55`.
Tune downward before tuning upward.

## Technical defensibility

- Concrete, painted metal, asphalt, and grass/soil albedos came from neutral,
  straight-on generated source surfaces. Their normals, roughness, and AO are
  conservative luminance-derived approximations, not photogrammetric scans.
  They are appropriate for subtle shading and should not drive displacement or
  collision.
- Diamond plate, utility panels, vehicle paint, and vehicle rubber are generated
  deterministically by `build_pbr.py`. Diamond tread, panel seams, and rivets use
  analytic height fields, so those normal maps are physically coherent with the
  authored relief.
- Painted surfaces are dielectrics in the packed metalness channel. Utility-panel
  rivets alone rise toward metallic values. Diamond plate is authored as exposed
  steel. Vehicle paint stays non-metallic; use `MeshPhysicalMaterial.clearcoat`
  if a smoother automotive response is wanted.
- AO is deliberately mild. It adds micro-occlusion only and does not bake room
  lighting, sunlight, or large cast shadows.

## Browser and KTX2 guidance

The 23 runtime WebPs total 23,331,214 bytes (22.25 MiB). Avoid eagerly uploading
all maps at startup on low-memory devices: load the indoor group first, then the
exterior/vehicle group at the exit transition, and dispose textures no longer in
use. The retained source PNGs total 12.71 MiB but are build inputs only.

All runtime images are 2K, power-of-two, RGB, and ready for an eventual KTX2
pipeline. Preserve sRGB metadata for albedo and linear metadata for normal/ORM.
For Basis Universal, UASTC is preferred for normal maps and ORM channel fidelity;
albedo may use ETC1S when download size matters more than fine texture detail.
Generate mipmaps during the KTX2 step and keep the packed ORM channel order.

## Provenance and usage status

No downloaded stock textures or third-party photographs are used in PBR v2.

- Concrete, painted metal, asphalt, and grass/soil source PNGs were created for
  SPECTER on 2026-08-08 using OpenAI's built-in image-generation mode. The exact
  source PNGs are preserved under `sources/`, and their prompts and SHA-256 hashes
  are recorded in `manifest.json`.
- Diamond plate, utility panels, vehicle paint, vehicle rubber, all derived data
  maps, and the QA previews were created locally by the project-authored
  deterministic builder in this folder.
- These assets are project-generated, not asserted to be CC0 or public domain.
  They contain no external source-asset license obligation. Distribution and use
  remain subject to the project owner's rights and the applicable OpenAI terms.
  Keep this README and `manifest.json` with redistributed source assets.

## Source-generation prompts

### Concrete

```text
Use case: stylized-concept
Asset type: seamless tileable game texture source for a modern military facility
Primary request: high-detail poured architectural concrete wall surface, cool medium gray, subtle aggregate, pinholes, faint formwork variation, restrained age and a few hairline cracks
Style/medium: photorealistic orthographic material scan, production texture source
Composition/framing: perfectly straight-on flat surface filling the entire square frame, uniform texel density
Lighting/mood: neutral diffuse overcast illumination, no directional light, no shadows, no highlights, no vignette
Materials/textures: realistic fine aggregate and pores, restrained tonal range, no large unique stains
Constraints: genuinely seamless on all four edges; no perspective; no seams or panel borders; no text; no logos; no objects; no watermark; no baked cast shadows or specular glare; no obvious focal feature
```

### Painted metal

```text
Use case: stylized-concept
Asset type: seamless tileable game texture source for a grounded modern blacksite
Primary request: charcoal olive-gray powder-coated steel surface with subtle orange-peel coating, fine scuffs, tiny edge-free chips exposing dark steel, faint handling wear
Style/medium: photorealistic orthographic material scan, production texture source
Composition/framing: perfectly straight-on flat continuous coated metal surface filling the square frame
Lighting/mood: flat neutral diffuse studio illumination, no directional highlights, no shadows, no vignette
Materials/textures: realistic matte powder coat, restrained wear, very subtle grime speckling, no dramatic rust
Constraints: genuinely seamless all edges; no panel lines, bolts, text, logos or objects; no perspective; no watermark; no baked reflection or glare; no large unique scratch or focal mark
```

### Asphalt

```text
Use case: stylized-concept
Asset type: seamless tileable game texture source for an exterior military compound
Primary request: realistic weathered black asphalt paving, dense fine aggregate, subtle repaired granules and pale dust in pores, lightly worn but maintained
Style/medium: photorealistic orthographic material scan, production texture source
Composition/framing: top-down perfectly flat surface filling the square frame, uniform scale
Lighting/mood: neutral diffuse overcast illumination with no cast shadows, no sun direction, no vignette
Materials/textures: varied small aggregate, micro cracks only, restrained charcoal color, no road markings
Constraints: genuinely seamless on every edge; no leaves, trash, tire tracks, paint, puddles, curbs, text or logos; no perspective; no watermark; no baked highlights; no large unique crack or focal feature
```

### Grass and soil

```text
Use case: stylized-concept
Asset type: seamless tileable game texture source for exterior ground in a modern tactical shooter
Primary request: patchy temperate field ground blending short realistic grass, compact dark brown soil, sparse clover-like weeds and a little dry straw, maintained perimeter terrain rather than lush lawn
Style/medium: photorealistic orthographic material scan, production texture source
Composition/framing: true top-down nadir view, flat ground filling the square frame, consistent small-scale vegetation
Lighting/mood: neutral diffuse overcast illumination, no directional shadows, no vignette
Materials/textures: believable grass blades and exposed compact soil with natural fine variation
Constraints: genuinely seamless all edges; no flowers, rocks, branches, footprints, tire tracks, litter, text, logos, watermark or large focal clump; no perspective; no baked cast shadows or bright sun highlights
```

## Rebuild and QA

Run `build_pbr.py` with Python 3, Pillow, and NumPy. The generated runtime maps are
deterministic for the retained inputs and fixed seed. `pbr-v2-contact-sheet.webp`
shows albedo, normal, and raw ORM channels; `pbr-v2-tiling-preview.webp` repeats
each albedo 3 x 3 to expose edge seams. Both previews were visually inspected on
2026-08-08: all eight families decode correctly, stay free of baked directional
lighting, and show no hard tile-boundary seam.
