# Poly Haven Fir Sapling - source record

## State

**Source-only CC0 evaluation record; not runtime-approved.** No Poly Haven
download, glTF, buffer, texture, LOD, conversion, or derivative is stored in
this directory or referenced by the game.

## Source-page record

| Field | Recorded value |
| --- | --- |
| Candidate | Fir Sapling |
| Publisher | Poly Haven |
| Model author reported by source | Rico Cilliers (modeling) |
| Photography author reported by source | Rob Tuytel (photography) |
| Asset page | <https://polyhaven.com/a/fir_sapling> |
| File metadata API | <https://api.polyhaven.com/files/fir_sapling> |
| Official 1K glTF root supplied for evaluation | <https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/fir_sapling/fir_sapling_1k.gltf> |
| License | CC0 1.0 Universal |
| Source geometry constraint | Approximately 433K source triangles |
| LOD status | No exported LOD hierarchy is available in the reported source package |
| Intended SPECTER use | Potential near-forest vegetation source study only; not an approved runtime tree or a replacement for existing procedural/card tiers |

## Why this is not runtime-approved

The source geometry is far above SPECTER's repeatable-world vegetation budget.
No exported LOD hierarchy, Meshopt/Draco test, texture compression profile, or
Intel/High browser measurement is currently available.  The fact that Poly Haven
licenses the source as CC0 does not make a 433K-triangle asset safe to instance
or appropriate for the current forest's Low/Intel path.

No runtime loader, service worker, HTML, or JavaScript file references the asset
page, API, or download URL.  A future download must be kept outside the runtime
path until conversion and QA are complete.

## Required evidence before promotion

1. Preserve the untouched source package, source URL/API response, download date,
   archive/file SHA-256 values, and upstream CC0/provenance materials.
2. Inventory the actual nodes, primitive counts, texture resolutions, material
   slots, transparency behavior, and every dependency from the downloaded root.
3. Produce a measured LOD hierarchy appropriate for repeated trees/saplings;
   record triangle counts, distances, culling, and visual comparisons.  A source
   without exported LODs must not be used as a repeated LOD0 stand-in.
4. Evaluate Meshopt and browser-supported texture compression only after actual
   decode/performance tests.  Do not assume compression makes the source suitable.
5. Pass High and Intel/Low memory, frame-time, forest-density, shadow-distance,
   alpha, fog, and streaming QA before any runtime import is proposed.
