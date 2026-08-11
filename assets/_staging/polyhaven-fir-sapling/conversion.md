# Conversion / LOD status

## Current result

**No asset conversion has occurred.** No official glTF root, dependency, texture,
mesh, LOD, or compressed output exists in this repository.

## Required non-runtime conversion study

1. Acquire and hash the untouched source before loading it into a converter.
2. Measure actual source geometry.  The reported roughly 433K triangles is a
   source warning, not an acceptable runtime budget or an estimate of any future
   optimized output.
3. Build and document a real LOD chain for the role selected (near hero foliage,
   mid-distance repeatable sapling, or far billboard/card).  Record per-LOD
   triangle count, material count, texture tier, culling range, and screen-space
   switch thresholds.
4. Test alpha/transparency, normal orientation, shadow rendering, fog response,
   and instancing.  The unmodified source may not be used as a repeated instance
   while an LOD chain is absent.
5. Evaluate Meshopt and texture compression with actual browser decoder and
   memory tests.  Document tool versions, original source hashes, outputs, and
   compressed output hashes.

## Promotion boundary

Only a separately documented, verified runtime derivative could be proposed for
an environment asset directory.  It must have local attribution, lower texture
tiers, and an explicit loader/manifest entry; it must never point at this staging
record or an external Poly Haven URL at runtime.
