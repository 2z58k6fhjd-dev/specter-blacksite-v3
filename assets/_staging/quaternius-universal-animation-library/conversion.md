# Conversion / retargeting status

## Current result

**No conversion has occurred.** There is no downloaded file to inspect, no GLB
output, no retargeted clip, and no runtime reference.

## Planned evaluation path

1. Retain the untouched original archive outside a runtime/precache path and
   fill `ORIGINAL.sha256` from that archive.
2. Inventory exact clips before export.  A title/category on the source page is
   not enough to infer a tactical reload, bolt timing, or first-person handling.
3. Inspect source skeleton scale, axes, rest pose, named bones, sampled keys,
   and root-motion behavior.  Record the tool and version used for the import.
4. Create a non-runtime test conversion first.  Record selected source clip
   name, duration, FPS, bone map, root handling, output file hash, and any
   correction layers.
5. Only after QA may a separate, optimized runtime asset be proposed with a
   local license/provenance record and an entry in `THIRD_PARTY_ASSETS.md`.

## Explicit limits

Generic body motion may help third-person movement and grounded deaths.  It may
not replace project-authored viewmodel choreography, hand-to-magazine contact,
optic alignment, bolt/slide animation, muzzle anchor placement, or weapon
mechanism events.
